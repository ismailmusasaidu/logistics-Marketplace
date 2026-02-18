import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Platform, Linking, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, MapPin, Clock, Plus, X, User, Phone, ChevronDown, ChevronUp, Layers, Navigation, Search, Tag, Receipt, Star, ArrowDown, Truck, CheckCircle2, CircleDot, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/lib/supabase';
import { coreBackend } from '@/lib/coreBackend';
import BulkOrderModal from '@/components/BulkOrderModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { PricingBreakdown } from '@/components/PricingBreakdown';
import { Toast } from '@/components/Toast';
import { OrderReceiptModal } from '@/components/OrderReceiptModal';
import RatingModal from '@/components/RatingModal';
import { pricingCalculator, PricingBreakdown as PricingBreakdownType, Promotion } from '@/lib/pricingCalculator';
import { calculateDistanceBetweenAddresses } from '@/lib/geocoding';
import { PaymentMethod, walletService } from '@/lib/wallet';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { matchAddressToZone } from '@/lib/zoneMatching';
import { Fonts } from '@/constants/fonts';

export default function CustomerHome() {
  const { profile, locationAddress, locationPermissionDenied, locationLoading, refreshLocation } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [newOrder, setNewOrder] = useState({
    pickupAddress: '',
    pickupInstructions: '',
    deliveryAddress: '',
    deliveryInstructions: '',
    recipientName: '',
    recipientPhone: '',
    packageDescription: '',
    orderTypes: [] as string[],
    orderSize: '' as 'small' | 'medium' | 'large' | '',
    promoCode: '',
  });
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdownType | null>(null);
  const [validatedPromo, setValidatedPromo] = useState<Promotion | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    reference: string;
    orderDetails: any;
  } | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<string | null>(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState<Order | null>(null);
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set());
  const [ratingRiderName, setRatingRiderName] = useState('Your Rider');

  const orderTypeOptions = ['Groceries', 'Medicine', 'Bulk / Heavy Items', 'Express Delivery'];

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    pricingCalculator.initialize();
    loadOrders();

    const ordersChannel = coreBackend
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${profile?.id}`,
        },
        (payload) => {
          console.log('Order change detected:', payload);
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      coreBackend.removeChannel(ordersChannel);
    };
  }, [profile?.id]);

  const loadOrders = async () => {
    try {
      const { data, error } = await coreBackend
        .from('orders')
        .select('*')
        .eq('customer_id', profile?.id)
        .eq('order_source', 'logistics')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateDistanceAndPricing = useCallback(async () => {
    if (!newOrder.pickupAddress || !newOrder.deliveryAddress) {
      setCalculatedDistance(null);
      setPricingBreakdown(null);
      setGeocodingError(null);
      return;
    }

    if (newOrder.pickupAddress.length < 5 || newOrder.deliveryAddress.length < 5) {
      return;
    }

    setCalculatingDistance(true);
    setGeocodingError(null);

    try {
      const result = await calculateDistanceBetweenAddresses(
        newOrder.pickupAddress,
        newOrder.deliveryAddress
      );

      if (!result) {
        setGeocodingError('Unable to find addresses. Please use detailed addresses with landmarks (e.g., "10 Admiralty Way, Lekki Phase 1" or "Plot 1234, Victoria Island, Lagos")');
        setCalculatedDistance(null);
        setPricingBreakdown(null);
        return;
      }

      setCalculatedDistance(result.distance);

      await pricingCalculator.initialize(true);

      if (!pricingCalculator.isReady()) {
        setGeocodingError('Unable to load delivery pricing. Please check your internet connection and try again.');
        setCalculatedDistance(null);
        setPricingBreakdown(null);
        return;
      }

      let promo: Promotion | null = null;
      if (newOrder.promoCode.trim()) {
        promo = await pricingCalculator.validatePromoCode(
          newOrder.promoCode.trim(),
          profile?.id || '',
          0
        );
        setValidatedPromo(promo);
      } else {
        setValidatedPromo(null);
      }

      const breakdown = pricingCalculator.calculateDeliveryPrice(
        result.distance,
        newOrder.orderTypes,
        0,
        promo,
        newOrder.orderSize
      );

      setPricingBreakdown(breakdown);
      setGeocodingError(null);
    } catch (error: any) {
      console.error('Error calculating distance and pricing:', error);
      setGeocodingError(getUserFriendlyError(error));
      setPricingBreakdown(null);
      setCalculatedDistance(null);
    } finally {
      setCalculatingDistance(false);
    }
  }, [newOrder.pickupAddress, newOrder.deliveryAddress, newOrder.orderTypes, newOrder.orderSize, newOrder.promoCode, profile?.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateDistanceAndPricing();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [calculateDistanceAndPricing]);

  const toggleOrderType = (type: string) => {
    setNewOrder(prev => {
      const types = prev.orderTypes.includes(type)
        ? prev.orderTypes.filter(t => t !== type)
        : [...prev.orderTypes, type];
      return { ...prev, orderTypes: types };
    });
  };

  const proceedToCheckout = () => {
    if (!newOrder.pickupAddress || !newOrder.deliveryAddress || !newOrder.recipientName || !newOrder.recipientPhone || !newOrder.packageDescription) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    if (!pricingBreakdown) {
      showToast('Please wait for pricing to be calculated', 'info');
      return;
    }

    setCheckoutModalVisible(true);
  };

  const assignRiderToOrder = async (orderId: string) => {
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/assign-rider`;
      const { data: { session } } = await coreBackend.auth.getSession();
      const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Rider assigned successfully:', result);
      } else {
        console.log('No rider available for assignment:', result.message);
      }
    } catch (error) {
      console.error('Error assigning rider:', error);
    }
  };

  const buildNotesFromForm = () => {
    const parts: string[] = [];
    if (newOrder.packageDescription) parts.push(`Package: ${newOrder.packageDescription}`);
    if (newOrder.recipientName) parts.push(`Recipient: ${newOrder.recipientName}`);
    if (newOrder.recipientPhone) parts.push(`Recipient Phone: ${newOrder.recipientPhone}`);
    if (newOrder.pickupInstructions) parts.push(`Pickup Instructions: ${newOrder.pickupInstructions}`);
    if (newOrder.deliveryInstructions) parts.push(`Delivery Instructions: ${newOrder.deliveryInstructions}`);
    if (newOrder.orderSize) parts.push(`Size: ${newOrder.orderSize}`);
    if (newOrder.orderTypes.length > 0) parts.push(`Types: ${newOrder.orderTypes.join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : null;
  };

  const buildDeliveryAddress = () => {
    return newOrder.deliveryAddress;
  };

  const verifyAndCreateOrder = async (reference: string, orderDetails: any) => {
    console.log('=== Starting verification ===');
    console.log('Reference:', reference);
    setVerifyingPayment(true);
    console.log('Verifying payment state set to TRUE');
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-payment`;
      const { data: { session } } = await coreBackend.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      });

      const verificationResult = await response.json();

      if (!verificationResult.success || !verificationResult.verified) {
        let errorMessage = 'Payment verification failed. Order not created.';

        if (verificationResult.message) {
          const msg = verificationResult.message.toLowerCase();

          if (msg.includes('declined') || msg.includes('card declined')) {
            errorMessage = 'Your card was declined. Please check your card details or try a different card.';
          } else if (msg.includes('insufficient') || msg.includes('funds')) {
            errorMessage = 'Insufficient funds. Please check your account balance and try again.';
          } else if (msg.includes('expired')) {
            errorMessage = 'Your card has expired. Please use a different card.';
          } else if (msg.includes('invalid')) {
            errorMessage = 'Invalid card details. Please check and try again.';
          } else if (msg.includes('cancelled')) {
            errorMessage = 'Payment was cancelled. No order was created.';
          } else if (msg.includes('abandoned')) {
            errorMessage = 'Payment was not completed. No order was created.';
          } else if (msg.includes('timeout') || msg.includes('timed out')) {
            errorMessage = 'Payment timed out. Please try again.';
          } else if (msg.includes('network') || msg.includes('connection')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else if (verificationResult.gatewayResponse) {
            errorMessage = `Payment failed: ${verificationResult.gatewayResponse}`;
          } else {
            errorMessage = `Payment failed: ${verificationResult.message}`;
          }
        }

        setVerifyingPayment(false);
        setPendingPaymentData(null);
        throw new Error(errorMessage);
      }

      const { data: orderData, error: orderError } = await coreBackend
        .from('orders')
        .insert({
          customer_id: orderDetails.customer_id,
          order_number: orderDetails.order_number,
          pickup_address: orderDetails.pickup_address,
          pickup_instructions: orderDetails.pickup_instructions,
          delivery_address: orderDetails.delivery_address,
          delivery_instructions: orderDetails.delivery_instructions,
          recipient_name: orderDetails.recipient_name,
          recipient_phone: orderDetails.recipient_phone,
          package_description: orderDetails.package_description,
          order_size: orderDetails.order_size,
          order_types: orderDetails.order_types,
          delivery_fee: orderDetails.delivery_fee,
          payment_method: 'online',
          payment_status: 'completed',
          status: 'pending',
          notes: orderDetails.notes,
          order_source: 'logistics',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      if (orderDetails.validatedPromo) {
        await pricingCalculator.incrementPromoUsage(orderDetails.validatedPromo.promo_code);
      }

      setVerifyingPayment(false);
      setModalVisible(false);
      setNewOrder({
        pickupAddress: '',
        pickupInstructions: '',
        deliveryAddress: '',
        deliveryInstructions: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        orderTypes: [],
        orderSize: '',
        promoCode: '',
      });
      setCalculatedDistance(null);
      setPricingBreakdown(null);
      setValidatedPromo(null);
      setGeocodingError(null);

      showToast('Payment successful! Order created.', 'success');
      loadOrders();
      setPendingPaymentData(null);

      if (orderData?.id) {
        assignRiderToOrder(orderData.id);
      }

      return true;
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setVerifyingPayment(false);
      setPendingPaymentData(null);

      throw new Error(getUserFriendlyError(error));
    }
  };

  useEffect(() => {
    console.log('useEffect triggered. pendingPaymentData:', pendingPaymentData);
    if (pendingPaymentData) {
      console.log('Scheduling verification in 100ms');
      setTimeout(() => {
        console.log('Now calling verifyAndCreateOrder');
        verifyAndCreateOrder(pendingPaymentData.reference, pendingPaymentData.orderDetails);
      }, 100);
    }
  }, [pendingPaymentData]);

  useEffect(() => {
    console.log('verifyingPayment state changed to:', verifyingPayment);
  }, [verifyingPayment]);

  const createOrderWithPayment = async (paymentMethod: PaymentMethod, paystackReference?: string, scheduledTime?: Date) => {
    if (!pricingBreakdown || !profile?.id) {
      throw new Error('Missing required information');
    }

    try {
      const orderNumber = `ORD-${Date.now()}`;
      const deliveryAddress = buildDeliveryAddress();
      const notes = buildNotesFromForm();

      if (paymentMethod === 'online') {
        if (!paystackReference) {
          throw new Error('Payment reference is required for online payment');
        }

        const orderDetails = {
          customer_id: profile.id,
          order_number: orderNumber,
          pickup_address: newOrder.pickupAddress,
          pickup_instructions: newOrder.pickupInstructions,
          delivery_address: deliveryAddress,
          delivery_instructions: newOrder.deliveryInstructions,
          recipient_name: newOrder.recipientName,
          recipient_phone: newOrder.recipientPhone,
          package_description: newOrder.packageDescription,
          order_size: newOrder.orderSize,
          order_types: newOrder.orderTypes,
          delivery_fee: pricingBreakdown.finalPrice,
          notes: notes,
          validatedPromo: validatedPromo,
        };

        console.log('Payment completed with reference:', paystackReference);

        const verified = await verifyAndCreateOrder(paystackReference, orderDetails);

        if (!verified) {
          throw new Error('Payment verification failed');
        }

        setCheckoutModalVisible(false);
        return;
      }

      const insertData: any = {
        customer_id: profile.id,
        order_number: orderNumber,
        pickup_address: newOrder.pickupAddress,
        pickup_instructions: newOrder.pickupInstructions,
        delivery_address: deliveryAddress,
        delivery_instructions: newOrder.deliveryInstructions,
        recipient_name: newOrder.recipientName,
        recipient_phone: newOrder.recipientPhone,
        package_description: newOrder.packageDescription,
        order_size: newOrder.orderSize,
        order_types: newOrder.orderTypes,
        delivery_fee: pricingBreakdown.finalPrice,
        payment_method: paymentMethod,
        payment_status: 'pending',
        status: 'pending',
        notes: notes,
        order_source: 'logistics',
      };

      const { data: orderData, error: orderError } = await coreBackend
        .from('orders')
        .insert(insertData)
        .select()
        .single();

      if (orderError) throw orderError;

      if (paymentMethod === 'wallet') {
        const success = await walletService.processWalletPayment(
          profile.id,
          pricingBreakdown.finalPrice,
          orderData.id,
          orderNumber
        );

        if (!success) {
          await coreBackend.from('orders').delete().eq('id', orderData.id);
          throw new Error('Insufficient wallet balance');
        }
      }

      if (validatedPromo) {
        await pricingCalculator.incrementPromoUsage(validatedPromo.promo_code);
      }

      let paymentMsg = '';
      let toastType: 'success' | 'info' = 'success';

      if (paymentMethod === 'wallet') {
        paymentMsg = 'Order placed and paid via wallet!';
      } else if (paymentMethod === 'transfer') {
        paymentMsg = 'Order placed! Please complete bank transfer.';
        toastType = 'info';
      } else {
        paymentMsg = 'Order placed! Pay cash on delivery.';
      }

      showToast(paymentMsg, toastType);

      setModalVisible(false);
      setCheckoutModalVisible(false);
      setNewOrder({
        pickupAddress: '',
        pickupInstructions: '',
        deliveryAddress: '',
        deliveryInstructions: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        orderTypes: [],
        orderSize: '',
        promoCode: '',
      });
      setCalculatedDistance(null);
      setPricingBreakdown(null);
      setValidatedPromo(null);
      setGeocodingError(null);
      loadOrders();

      if (orderData?.id) {
        assignRiderToOrder(orderData.id);
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#8b5cf6',
      ready_for_pickup: '#6366f1',
      out_for_delivery: '#06b6d4',
      delivered: '#f97316',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const parseOrderNotes = (notes: string): { label: string; value: string }[] => {
    return notes
      .split('|')
      .map(part => part.trim())
      .filter(part => part.includes(':'))
      .map(part => {
        const colonIdx = part.indexOf(':');
        return {
          label: part.substring(0, colonIdx).trim(),
          value: part.substring(colonIdx + 1).trim(),
        };
      })
      .filter(item => item.value.length > 0);
  };

  const handleViewReceipt = (orderId: string) => {
    setSelectedOrderForReceipt(orderId);
    setReceiptModalVisible(true);
  };

  const handleCloseReceipt = () => {
    setReceiptModalVisible(false);
    setSelectedOrderForReceipt(null);
  };

  const handleOpenRating = async (order: Order) => {
    setSelectedOrderForRating(order);
    setRatingRiderName('Your Rider');
    if (order.rider_id) {
      try {
        const { data: riderData } = await coreBackend
          .from('riders')
          .select('user_id')
          .eq('id', order.rider_id)
          .maybeSingle();
        if (riderData?.user_id) {
          const { data: profileData } = await coreBackend
            .from('profiles')
            .select('full_name')
            .eq('id', riderData.user_id)
            .maybeSingle();
          if (profileData?.full_name) {
            setRatingRiderName(profileData.full_name);
          }
        }
      } catch {}
    }
    setRatingModalVisible(true);
  };

  const handleCloseRating = () => {
    setRatingModalVisible(false);
    setSelectedOrderForRating(null);
  };

  const handleRatingSuccess = () => {
    if (selectedOrderForRating) {
      setRatedOrders(prev => new Set(prev).add(selectedOrderForRating.id));
    }
    showToast('Rating submitted successfully!', 'success');
  };

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  const filteredCompletedOrders = completedOrders.filter(order => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.delivery_address.toLowerCase().includes(query) ||
      (order.notes && order.notes.toLowerCase().includes(query))
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#1c1917', '#292524']} style={styles.headerGradient}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {profile?.full_name ? `Hey, ${profile.full_name.split(' ')[0]}` : 'Welcome back'}
            </Text>
            <View style={styles.locationRow}>
              <MapPin size={13} color="#f97316" />
              <Text style={styles.locationText} numberOfLines={2}>
                {locationLoading ? 'Updating location...' : (locationAddress || 'Location unavailable')}
              </Text>
              <TouchableOpacity
                style={styles.locationRefreshBtn}
                onPress={refreshLocation}
                disabled={locationLoading}
                activeOpacity={0.7}>
                {locationLoading ? (
                  <ActivityIndicator size={12} color="#f97316" />
                ) : (
                  <RefreshCw size={12} color="#f97316" />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.bulkButton} onPress={() => setBulkModalVisible(true)}>
              <Layers size={18} color="#f97316" />
              <Text style={styles.bulkButtonText}>Bulk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Plus size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Truck size={16} color="#f97316" />
            </View>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'out_for_delivery').length}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <CheckCircle2 size={16} color="#22c55e" />
            </View>
            <Text style={[styles.statNumber, { color: '#22c55e' }]}>{orders.filter(o => o.status === 'delivered').length}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(234,179,8,0.15)' }]}>
              <CircleDot size={16} color="#eab308" />
            </View>
            <Text style={[styles.statNumber, { color: '#eab308' }]}>{orders.filter(o => o.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => {
              setActiveTab('active');
              setSearchQuery('');
            }}>
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active ({activeOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => {
              setActiveTab('history');
              setSearchQuery('');
            }}>
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History ({completedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />}>

        {activeTab === 'active' && (
          <>
            <Text style={styles.sectionTitle}>Active Orders</Text>

            {activeOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>No active orders</Text>
                <Text style={styles.emptySubtext}>Your active orders will appear here</Text>
              </View>
            ) : (
              activeOrders.map((order, index) => (
            <View key={order.id} style={styles.orderCard}>
              <LinearGradient
                colors={['#fff7ed', '#ffffff']}
                style={styles.orderCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}>

                <View style={styles.orderCardTopRow}>
                  <View style={styles.orderCardIconWrap}>
                    <LinearGradient colors={['#f97316', '#ea580c']} style={styles.orderCardIcon}>
                      <Package size={22} color="#ffffff" />
                    </LinearGradient>
                  </View>
                  <View style={styles.orderCardMeta}>
                    <Text style={styles.orderCardNumber}>{order.order_number}</Text>
                    <Text style={styles.orderCardDate}>
                      {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(order.status) + '22', borderColor: getStatusColor(order.status) + '55' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                    <Text style={[styles.statusPillText, { color: getStatusColor(order.status) }]}>{getStatusLabel(order.status)}</Text>
                  </View>
                </View>

                <View style={styles.routeContainer}>
                  <View style={styles.routeRow}>
                    <View style={styles.routeIconCol}>
                      <View style={[styles.routeCircle, styles.routeCircleOrigin]}>
                        <View style={styles.routeCircleInner} />
                      </View>
                      <View style={styles.routeLine} />
                      <View style={[styles.routeCircle, styles.routeCircleDest]}>
                        <MapPin size={10} color="#ffffff" />
                      </View>
                    </View>
                    <View style={styles.routeTextCol}>
                      {order.pickup_address ? (
                        <View style={styles.routeTextBlock}>
                          <Text style={styles.routeLabel}>PICKUP</Text>
                          <Text style={styles.routeAddress} numberOfLines={2}>{order.pickup_address}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.routeTextBlock, { marginTop: order.pickup_address ? 0 : 0 }]}>
                        <Text style={[styles.routeLabel, { color: '#f97316' }]}>DELIVERY</Text>
                        <Text style={styles.routeAddress} numberOfLines={2}>{order.delivery_address}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {order.notes && (
                  <View style={styles.notesCard}>
                    <View style={styles.notesCardHeader}>
                      <Package size={13} color="#f97316" />
                      <Text style={styles.notesCardTitle}>Package Info</Text>
                    </View>
                    {parseOrderNotes(order.notes).map((item, i) => (
                      <View key={i} style={styles.notesInfoRow}>
                        <Text style={styles.notesInfoLabel}>{item.label}</Text>
                        <Text style={styles.notesInfoValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.orderCardFooter}>
                  <View style={styles.feeBox}>
                    <Text style={styles.feeLabelSmall}>Delivery Fee</Text>
                    <Text style={styles.feeAmount}>₦{order.delivery_fee.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.receiptBtn}
                    onPress={() => handleViewReceipt(order.id)}>
                    <Receipt size={15} color="#f97316" />
                    <Text style={styles.receiptBtnText}>Receipt</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          ))
        )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            <View style={styles.historyHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Order History</Text>
                <Text style={styles.historySubheading}>Your past deliveries</Text>
              </View>
            </View>

            <View style={styles.searchContainer}>
              <Search size={18} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search orders, addresses..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#c4c9d4"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.searchClearBtn} onPress={() => setSearchQuery('')}>
                  <X size={16} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>

            {completedOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>No completed orders</Text>
                <Text style={styles.emptySubtext}>Your order history will appear here</Text>
              </View>
            ) : (
              <>
                {!searchQuery && (
                  <LinearGradient
                    colors={['#ff8c00', '#f97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.historySummary}
                  >
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemValue}>
                        ₦{completedOrders
                          .filter(o => o.status === 'delivered')
                          .reduce((sum, o) => sum + o.delivery_fee, 0)
                          .toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                      </Text>
                      <Text style={styles.summaryItemLabel}>Total Spent</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemValue}>
                        {completedOrders.filter(o => o.status === 'delivered').length}
                      </Text>
                      <Text style={styles.summaryItemLabel}>Delivered</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemValue}>
                        {completedOrders.filter(o => o.status === 'cancelled').length}
                      </Text>
                      <Text style={styles.summaryItemLabel}>Cancelled</Text>
                    </View>
                  </LinearGradient>
                )}

                {filteredCompletedOrders.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Package size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>No orders found</Text>
                    <Text style={styles.emptySubtext}>Try adjusting your search</Text>
                  </View>
                ) : (
                  <>
                    {searchQuery && (
                      <Text style={styles.searchResults}>
                        {filteredCompletedOrders.length} {filteredCompletedOrders.length === 1 ? 'result' : 'results'} found
                      </Text>
                    )}
                    {filteredCompletedOrders.map((order) => (
                      <View key={order.id} style={styles.historyCard}>
                        <View style={styles.historyCardTopBar}>
                          <View style={[styles.historyStatusPill, {
                            backgroundColor: order.status === 'delivered' ? '#dcfce7' : '#fee2e2',
                          }]}>
                            {order.status === 'delivered'
                              ? <CheckCircle2 size={12} color="#16a34a" strokeWidth={2.5} />
                              : <X size={12} color="#dc2626" strokeWidth={2.5} />
                            }
                            <Text style={[styles.historyStatusPillText, {
                              color: order.status === 'delivered' ? '#16a34a' : '#dc2626',
                            }]}>
                              {order.status === 'delivered' ? 'Delivered' : 'Cancelled'}
                            </Text>
                          </View>
                          <Text style={styles.historyDate}>
                            {order.delivered_at
                              ? new Date(order.delivered_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })
                              : new Date(order.updated_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })
                            }
                          </Text>
                        </View>

                        <View style={styles.historyCardBody}>
                          <View style={styles.historyCardLeft}>
                            <Text style={styles.historyOrderNumber}>{order.order_number}</Text>
                            <View style={styles.historyAddressRow}>
                              <View style={styles.historyAddressDot} />
                              <Text style={styles.historyAddressText} numberOfLines={1}>
                                {order.delivery_address}
                              </Text>
                            </View>
                            {order.pickup_address ? (
                              <View style={styles.historyAddressRow}>
                                <View style={[styles.historyAddressDot, { backgroundColor: '#f97316' }]} />
                                <Text style={styles.historyAddressText} numberOfLines={1}>
                                  {order.pickup_address}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.historyCardRight}>
                            <Text style={styles.historyFeeLabel}>Delivery Fee</Text>
                            <Text style={styles.historyFee}>₦{order.delivery_fee.toLocaleString('en-NG')}</Text>
                          </View>
                        </View>

                        <View style={styles.historyCardFooter}>
                          <TouchableOpacity
                            style={styles.receiptButton}
                            onPress={() => handleViewReceipt(order.id)}>
                            <Receipt size={15} color="#f97316" strokeWidth={2} />
                            <Text style={styles.receiptButtonText}>Receipt</Text>
                          </TouchableOpacity>

                          {order.status === 'delivered' && !ratedOrders.has(order.id) && (
                            <TouchableOpacity
                              style={styles.ratingButton}
                              onPress={() => handleOpenRating(order)}>
                              <Star size={15} color="#f59e0b" strokeWidth={2} />
                              <Text style={styles.ratingButtonText}>Rate</Text>
                            </TouchableOpacity>
                          )}
                          {order.status === 'delivered' && ratedOrders.has(order.id) && (
                            <View style={styles.ratedBadge}>
                              <Star size={13} color="#10b981" fill="#10b981" />
                              <Text style={styles.ratedText}>Rated</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Order</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pickup Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos"
                  value={newOrder.pickupAddress}
                  onChangeText={(text) => setNewOrder({ ...newOrder, pickupAddress: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pickup Instructions (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Gate code, Parking info, Contact person..."
                  value={newOrder.pickupInstructions}
                  onChangeText={(text) => setNewOrder({ ...newOrder, pickupInstructions: text })}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Plot 1234, opposite Eko Hotel, Victoria Island, Lagos"
                  value={newOrder.deliveryAddress}
                  onChangeText={(text) => setNewOrder({ ...newOrder, deliveryAddress: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Instructions (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Call on arrival, Floor/Unit info, Security procedures..."
                  value={newOrder.deliveryInstructions}
                  onChangeText={(text) => setNewOrder({ ...newOrder, deliveryInstructions: text })}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={newOrder.recipientName}
                  onChangeText={(text) => setNewOrder({ ...newOrder, recipientName: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 234 567 8900"
                  value={newOrder.recipientPhone}
                  onChangeText={(text) => setNewOrder({ ...newOrder, recipientPhone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Package Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your package"
                  value={newOrder.packageDescription}
                  onChangeText={(text) => setNewOrder({ ...newOrder, packageDescription: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {(newOrder.pickupAddress && newOrder.deliveryAddress) && (
                <View style={styles.distanceDisplayContainer}>
                  <View style={styles.distanceHeader}>
                    <Navigation size={20} color="#f97316" />
                    <Text style={styles.distanceTitle}>Delivery Distance</Text>
                  </View>
                  {calculatingDistance ? (
                    <View style={styles.calculatingContainer}>
                      <ActivityIndicator size="small" color="#f97316" />
                      <Text style={styles.calculatingText}>Calculating distance...</Text>
                    </View>
                  ) : geocodingError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{geocodingError}</Text>
                    </View>
                  ) : calculatedDistance !== null ? (
                    <View style={styles.distanceValueContainer}>
                      <Text style={styles.distanceValue}>{calculatedDistance} km</Text>
                      <Text style={styles.distanceHint}>Distance calculated automatically</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order Size (Optional)</Text>
                <View style={styles.orderTypesContainer}>
                  {['small', 'medium', 'large'].map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.orderTypeChip,
                        newOrder.orderSize === size && styles.orderTypeChipActive,
                      ]}
                      onPress={() => setNewOrder({ ...newOrder, orderSize: size as 'small' | 'medium' | 'large' })}>
                      <Text
                        style={[
                          styles.orderTypeChipText,
                          newOrder.orderSize === size && styles.orderTypeChipTextActive,
                        ]}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order Type (Optional)</Text>
                <View style={styles.orderTypesContainer}>
                  {orderTypeOptions.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.orderTypeChip,
                        newOrder.orderTypes.includes(type) && styles.orderTypeChipActive,
                      ]}
                      onPress={() => toggleOrderType(type)}>
                      <Text
                        style={[
                          styles.orderTypeChipText,
                          newOrder.orderTypes.includes(type) && styles.orderTypeChipTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Promo Code (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter promo code"
                  value={newOrder.promoCode}
                  onChangeText={(text) => setNewOrder({ ...newOrder, promoCode: text.toUpperCase() })}
                  autoCapitalize="characters"
                />
                {validatedPromo && (
                  <Text style={styles.promoSuccess}>✓ {validatedPromo.promo_name} applied!</Text>
                )}
                {newOrder.promoCode && !validatedPromo && pricingBreakdown && !calculatingDistance && (
                  <Text style={styles.promoError}>Invalid or expired promo code</Text>
                )}
              </View>

              {pricingBreakdown && (
                <View style={styles.breakdownContainer}>
                  <PricingBreakdown breakdown={pricingBreakdown} />
                </View>
              )}

              <TouchableOpacity
                style={[styles.createButton, !pricingBreakdown && styles.createButtonDisabled]}
                onPress={proceedToCheckout}
                disabled={!pricingBreakdown}>
                <Text style={styles.createButtonText}>
                  {pricingBreakdown ? `Proceed to Checkout - ₦${pricingBreakdown.finalPrice.toFixed(2)}` : 'Calculate Price First'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {pricingBreakdown && (
        <CheckoutModal
          visible={checkoutModalVisible}
          onClose={() => setCheckoutModalVisible(false)}
          onConfirm={createOrderWithPayment}
          pricing={pricingBreakdown}
          userId={profile?.id || ''}
          userEmail={profile?.email || ''}
        />
      )}

      <BulkOrderModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onSuccess={() => {
          loadOrders();
          setBulkModalVisible(false);
        }}
        customerId={profile?.id || ''}
        showToast={showToast}
      />

      {verifyingPayment ? (
        <>
          {console.log('RENDERING VERIFICATION MODAL')}
          <Modal visible={true} transparent animationType="fade">
            <View style={styles.verifyingOverlay}>
              <View style={styles.verifyingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.verifyingTitle}>Verifying Payment</Text>
                <Text style={styles.verifyingText}>
                  Please wait while we confirm your payment...
                </Text>
              </View>
            </View>
          </Modal>
        </>
      ) : null}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={8000}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />

      <OrderReceiptModal
        visible={receiptModalVisible}
        onClose={handleCloseReceipt}
        orderId={selectedOrderForReceipt || ''}
      />

      {selectedOrderForRating && (
        <RatingModal
          visible={ratingModalVisible}
          onClose={handleCloseRating}
          orderId={selectedOrderForRating.id}
          riderId={selectedOrderForRating.rider_id || ''}
          customerId={profile?.id || ''}
          riderName={ratingRiderName}
          onSuccess={handleRatingSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerGradient: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  greeting: {
    fontSize: 26,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#a8a29e',
    flex: 1,
    lineHeight: 18,
  },
  locationRefreshBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(249,115,22,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  addButton: {
    backgroundColor: '#f97316',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#a8a29e',
    letterSpacing: 0.4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    marginTop: 4,
  },
  orderCard: {
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  orderCardGradient: {
    padding: 18,
  },
  orderCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  orderCardIconWrap: {
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  orderCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCardMeta: {
    flex: 1,
  },
  orderCardNumber: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.3,
  },
  orderCardDate: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsBold,
    letterSpacing: 0.2,
  },
  routeContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  routeRow: {
    flexDirection: 'row',
    gap: 14,
  },
  routeIconCol: {
    alignItems: 'center',
    width: 18,
    paddingTop: 3,
  },
  routeCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeCircleOrigin: {
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  routeCircleInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  routeCircleDest: {
    backgroundColor: '#f97316',
  },
  routeLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e5e7eb',
    marginVertical: 3,
    minHeight: 16,
  },
  routeTextCol: {
    flex: 1,
    gap: 14,
  },
  routeTextBlock: {
    gap: 3,
  },
  routeLabel: {
    fontSize: 10,
    fontFamily: Fonts.poppinsBold,
    color: '#6b7280',
    letterSpacing: 1,
  },
  routeAddress: {
    fontSize: 13,
    fontFamily: Fonts.poppinsMedium,
    color: '#111827',
    lineHeight: 18,
  },
  notesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 8,
  },
  notesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  notesCardTitle: {
    fontSize: 11,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  notesInfoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  notesInfoLabel: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
    minWidth: 110,
  },
  notesInfoValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.poppinsMedium,
    color: '#111827',
    flexWrap: 'wrap',
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  feeBox: {
    gap: 2,
  },
  feeLabelSmall: {
    fontSize: 10,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  feeAmount: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f97316',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  receiptBtnText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Fonts.poppinsBold,
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
  },
  orderDetails: {
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    fontFamily: Fonts.poppinsMedium,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsRegular,
  },
  feeText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#f97316',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingTop: 4,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(249,115,22,0.15)',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
  },
  bulkButtonText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  distanceDisplayContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  distanceTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculatingText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsMedium,
    color: '#dc2626',
  },
  distanceValueContainer: {
    gap: 4,
  },
  distanceValue: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  distanceHint: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  orderTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  orderTypeChipActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#f97316',
  },
  orderTypeChipText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
  },
  orderTypeChipTextActive: {
    color: '#f97316',
  },
  promoSuccess: {
    fontSize: 13,
    color: '#f97316',
    fontFamily: Fonts.poppinsSemiBold,
    marginTop: 4,
  },
  promoError: {
    fontSize: 13,
    color: '#ef4444',
    fontFamily: Fonts.poppinsSemiBold,
    marginTop: 4,
  },
  breakdownContainer: {
    marginBottom: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#f97316',
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#78716c',
  },
  tabTextActive: {
    color: '#f97316',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  historySubheading: {
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    marginTop: 2,
  },
  historySummary: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemValue: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
    marginBottom: 4,
  },
  summaryItemLabel: {
    fontSize: 11,
    fontFamily: Fonts.poppinsMedium,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  historyCardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  historyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  historyStatusPillText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsSemiBold,
    letterSpacing: 0.2,
  },
  historyDate: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
  },
  historyCardBody: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  historyCardLeft: {
    flex: 1,
    gap: 6,
  },
  historyCardRight: {
    alignItems: 'flex-end',
  },
  historyOrderNumber: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  historyAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyAddressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6b7280',
  },
  historyAddressText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  historyFeeLabel: {
    fontSize: 10,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  historyFee: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  historyCardFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  searchResults: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: Fonts.poppinsMedium,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  verifyingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  verifyingContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 280,
    elevation: 100000,
    zIndex: 100000,
  },
  verifyingTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  verifyingText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    textAlign: 'center',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  receiptButtonText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  ratingButtonText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f59e0b',
  },
  ratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  ratedText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#16a34a',
  },
});
