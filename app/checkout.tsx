import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Truck, MapPin, CreditCard, ChevronLeft, CheckCircle, Clock, Wallet, DollarSign, Building2, Banknote } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { CORE_URL } from '@/lib/coreBackend';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { BankAccount } from '@/types/database';
import { Fonts } from '@/constants/fonts';

interface CartItemWithProduct {
  id: string;
  quantity: number;
  product_id: string;
  product: {
    id: string;
    name: string;
    price: number;
    unit: string;
    vendor_id: string;
  };
}

interface DeliveryZone {
  id: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  price: number;
  is_active: boolean;
}

export default function CheckoutScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [geocodedCoordinates, setGeocodedCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number>(0);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'transfer' | 'online' | 'wallet' | 'cash_on_delivery' | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const storeLocation = { latitude: 12.0022, longitude: 8.5919 };

  useEffect(() => {
    fetchCartItems();
    loadZones();
    fetchWalletBalance();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      setLoadingBankAccounts(true);
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoadingBankAccounts(false);
    }
  };

  useEffect(() => {
    if (deliveryType === 'delivery' && deliveryAddress.trim()) {
      const timeoutId = setTimeout(() => {
        calculateDistanceFromAddress(deliveryAddress);
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setGeocodedCoordinates(null);
      setCalculatedDeliveryFee(0);
      setGeocodeError('');
    }
  }, [deliveryAddress, deliveryType]);

  useEffect(() => {
    if (geocodedCoordinates) {
      calculateDeliveryFee();
    } else {
      setCalculatedDeliveryFee(0);
    }
  }, [geocodedCoordinates]);

  useEffect(() => {
    if (paymentUrl && showPaymentWebView) {
      Linking.openURL(paymentUrl).catch((err) => {
        console.error('Failed to open payment URL:', err);
        Alert.alert('Error', 'Failed to open payment page. Please try again.');
      });
    }
  }, [paymentUrl, showPaymentWebView]);

  const loadZones = async () => {
    const { data } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('min_distance_km');
    if (data) setZones(data);
  };

  const calculateDistanceFromAddress = async (address: string) => {
    try {
      setGeocoding(true);
      setGeocodeError('');

      const origin = `${storeLocation.latitude},${storeLocation.longitude}`;
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calculate-distance`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          origin,
          destination: address,
        }),
      });

      const data = await response.json();

      if (data.success && data.distanceKm) {
        setGeocodedCoordinates({ lat: data.distanceKm, lon: 0 });
        setGeocodeError('');
      } else if (data.error) {
        setGeocodeError(data.error);
        setGeocodedCoordinates(null);
      } else {
        setGeocodeError('Address not found. Please check and try again.');
        setGeocodedCoordinates(null);
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
      setGeocodeError('Failed to calculate distance. Please try again.');
      setGeocodedCoordinates(null);
    } finally {
      setGeocoding(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const findZoneForDistance = (distance: number): DeliveryZone | null => {
    for (const zone of zones) {
      if (distance >= zone.min_distance_km && distance <= zone.max_distance_km) {
        return zone;
      }
    }
    return null;
  };

  const calculateDeliveryFee = () => {
    if (!geocodedCoordinates) {
      setCalculatedDeliveryFee(0);
      return;
    }

    const distance = geocodedCoordinates.lat;
    const zone = findZoneForDistance(distance);

    if (zone) {
      setCalculatedDeliveryFee(zone.price);
    } else {
      setCalculatedDeliveryFee(0);
    }
  };

  const fetchCartItems = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('carts')
        .select(
          `
          id,
          quantity,
          product_id,
          products (
            id,
            name,
            price,
            unit,
            vendor_id
          )
        `
        )
        .eq('user_id', profile.id);

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        product_id: item.product_id,
        product: item.products,
      }));

      setCartItems(formattedData);
    } catch (error) {
      console.error('Error fetching cart:', error);
      Alert.alert('Error', 'Failed to load cart items');
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', profile.id)
        .single();

      if (error) throw error;
      if (data) {
        setWalletBalance(data.wallet_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const calculateDiscount = () => {
    if (!appliedPromo) return 0;

    const subtotal = calculateSubtotal();
    const deliveryFee = deliveryType === 'delivery' ? calculatedDeliveryFee : 0;

    if (appliedPromo.discount_type === 'percentage') {
      const discount = (subtotal * appliedPromo.discount_value) / 100;
      return appliedPromo.max_discount_amount
        ? Math.min(discount, appliedPromo.max_discount_amount)
        : discount;
    } else if (appliedPromo.discount_type === 'fixed_amount') {
      return Math.min(appliedPromo.discount_value, subtotal);
    } else if (appliedPromo.discount_type === 'free_delivery') {
      return deliveryFee;
    }

    return 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryFee = deliveryType === 'delivery' ? calculatedDeliveryFee : 0;
    const discount = calculateDiscount();
    return Math.max(0, subtotal + deliveryFee - discount);
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    setApplyingPromo(true);
    setPromoError('');

    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', promoCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setPromoError('Invalid promo code');
        return;
      }

      const now = new Date();
      const validFrom = new Date(data.valid_from);
      const validUntil = new Date(data.valid_until);

      if (now < validFrom) {
        setPromoError('This promo code is not yet active');
        return;
      }

      if (now > validUntil) {
        setPromoError('This promo code has expired');
        return;
      }

      if (data.usage_limit && data.usage_count >= data.usage_limit) {
        setPromoError('This promo code has reached its usage limit');
        return;
      }

      const subtotal = calculateSubtotal();
      if (data.min_order_amount && subtotal < data.min_order_amount) {
        setPromoError(`Minimum order amount is ₦${data.min_order_amount.toFixed(2)}`);
        return;
      }

      setAppliedPromo(data);
      Alert.alert('Success', 'Promo code applied successfully!');
    } catch (error) {
      console.error('Error applying promo code:', error);
      setPromoError('Failed to apply promo code');
    } finally {
      setApplyingPromo(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  const handleContinueToPayment = () => {
    if (!profile) return;

    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      Alert.alert('Missing Address', 'Please provide a delivery address');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryName.trim()) {
      Alert.alert('Missing Name', 'Please provide a delivery name');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryPhone.trim()) {
      Alert.alert('Missing Phone', 'Please provide a delivery phone number');
      return;
    }

    if (deliveryType === 'delivery' && !geocodedCoordinates) {
      Alert.alert('Invalid Address', 'Please enter a valid address that can be located on the map.');
      return;
    }

    if (deliveryType === 'delivery' && calculatedDeliveryFee === 0) {
      Alert.alert('Delivery Not Available', 'No delivery zone covers your location. Please try a different address.');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty');
      return;
    }

    setShowPaymentOptions(true);
  };

  const handlePayOnline = async () => {
    if (!profile) return;

    try {
      setInitializingPayment(true);

      const total = calculateTotal();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Error', 'You must be logged in to make a payment');
        return;
      }

      const email = profile.email || session.user?.email;
      if (!email) {
        Alert.alert('Error', 'Email address is required for payment');
        return;
      }

      const response = await fetch(`${CORE_URL}/functions/v1/initialize-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ amount: total, email }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        const errorMsg = result?.error || 'Failed to initialize payment';
        console.error('Payment initialization failed:', result);

        if (errorMsg === 'Paystack secret key not configured') {
          Alert.alert(
            'Coming Soon',
            'Online payment integration will be available soon. Please use another payment method.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Show detailed error from Paystack
        const detailedError = result?.details ?
          `${errorMsg}\n\nDetails: ${JSON.stringify(result.details, null, 2)}` :
          errorMsg;

        throw new Error(detailedError);
      }

      setPaymentUrl(result.data.authorization_url);
      setPaymentReference(result.data.reference);

      if (Platform.OS === 'web') {
        window.open(result.data.authorization_url, '_blank');
        setSelectedPaymentMethod(null);
        setShowPaymentWebView(true);
      } else {
        setSelectedPaymentMethod(null);
        setShowPaymentWebView(true);
      }
    } catch (error) {
      console.error('Error initializing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Paystack secret key not configured')) {
        Alert.alert(
          'Coming Soon',
          'Online payment integration will be available soon. Please use another payment method.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Payment Error', errorMessage || 'Failed to initialize payment. Please try again.');
      }
    } finally {
      setInitializingPayment(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentReference) {
      Alert.alert('Error', 'Payment reference is missing');
      return;
    }

    try {
      setSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Session expired. Please try again.');
        return;
      }

      const { data: result, error: invokeError } = await supabase.functions.invoke('verify-payment', {
        body: { reference: paymentReference, type: 'order' },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Payment verification failed');
      }

      if (result.success) {
        setShowPaymentWebView(false);
        await handlePlaceOrder('online', true);
      } else {
        console.error('Payment verification failed:', result.error);
        Alert.alert('Payment Failed', result.error || 'Payment verification failed. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to verify payment: ${errorMessage}. Please contact support if amount was deducted.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentWebViewMessage = async (event: any) => {
    const url = event.nativeEvent.url;

    if (url.includes('/functions/v1/verify-payment') && url.includes('reference=')) {
      setShowPaymentWebView(false);

      try {
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
          await handlePlaceOrder('online', true);
        } else {
          Alert.alert('Payment Failed', result.error || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        Alert.alert('Error', 'Failed to verify payment. Please contact support if amount was deducted.');
      }
    }
  };

  const handlePlaceOrder = async (paymentMethod: 'transfer' | 'online' | 'wallet' | 'cash_on_delivery', paymentCompleted: boolean = false) => {
    if (!profile) return;

    try {
      setSubmitting(true);

      const vendorId = cartItems[0].product.vendor_id;
      const orderNumber = `ORD-${Date.now()}`;
      const subtotal = calculateSubtotal();
      const deliveryFee = deliveryType === 'delivery' ? calculatedDeliveryFee : 0;
      const discount = calculateDiscount();
      const total = calculateTotal();

      if (paymentMethod === 'wallet') {
        if (walletBalance < total) {
          Alert.alert('Insufficient Balance', `Your wallet balance is ₦${walletBalance.toFixed(2)}. You need ₦${total.toFixed(2)} to complete this order.`);
          setSubmitting(false);
          return;
        }

        const { data: debitResult, error: debitError } = await supabase
          .rpc('debit_wallet', {
            p_user_id: profile.id,
            p_amount: total,
            p_description: `Payment for order ${orderNumber}`,
            p_reference_type: 'order'
          });

        if (debitError || !debitResult.success) {
          throw new Error(debitResult?.error || 'Failed to process wallet payment');
        }
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.id,
          vendor_id: vendorId,
          order_number: orderNumber,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          discount_amount: discount,
          promo_code: appliedPromo?.code || null,
          promo_id: appliedPromo?.id || null,
          total: total,
          delivery_type: deliveryType,
          delivery_address: deliveryType === 'delivery' ? `${deliveryName}\n${deliveryPhone}\n${deliveryAddress}` : 'N/A',
          status: 'pending',
          payment_method: paymentMethod,
          payment_status: (paymentMethod === 'wallet' || paymentCompleted) ? 'completed' : 'pending',
          order_source: 'marketplace',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      const { error: deleteError } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', profile.id);

      if (deleteError) throw deleteError;

      if (appliedPromo) {
        await supabase
          .from('promotions')
          .update({ usage_count: (appliedPromo.usage_count || 0) + 1 })
          .eq('id', appliedPromo.id);
      }

      setOrderNumber(orderNumber);
      setOrderPlaced(true);
      setShowPaymentOptions(false);
      if (paymentMethod === 'wallet') {
        await fetchWalletBalance();
      }
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (orderPlaced) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>Order Placed!</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.successContent}>
          <View style={styles.successIconContainer}>
            <View style={styles.successIconCircle}>
              <CheckCircle size={64} color="#ff8c00" strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.successTitle}>Order Confirmed!</Text>
          <Text style={styles.successMessage}>
            Your order has been placed successfully
          </Text>

          <View style={styles.orderDetailsCard}>
            <Text style={styles.orderDetailsTitle}>Order Details</Text>

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Order Number</Text>
              <Text style={styles.orderDetailValue}>#{orderNumber}</Text>
            </View>

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Delivery Type</Text>
              <Text style={styles.orderDetailValue}>
                {deliveryType === 'delivery' ? 'Home Delivery' : 'Pickup'}
              </Text>
            </View>

            {deliveryType === 'delivery' && (
              <View style={styles.orderDetailRow}>
                <Text style={styles.orderDetailLabel}>Delivery Address</Text>
                <Text style={[styles.orderDetailValue, styles.addressText]}>
                  {deliveryAddress}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Total Amount</Text>
              <Text style={styles.orderTotalValue}>₦{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>What's Next?</Text>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={styles.timelineIcon}>
                  <CheckCircle size={20} color="#ff8c00" fill="#ff8c00" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Order Confirmed</Text>
                <Text style={styles.timelineItemTime}>Just now</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                  <Clock size={20} color="#94a3b8" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Vendor Confirmation</Text>
                <Text style={styles.timelineItemTime}>Within 1 hour</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                  <Package size={20} color="#94a3b8" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Preparing Order</Text>
                <Text style={styles.timelineItemTime}>1-2 hours</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                  <Truck size={20} color="#94a3b8" />
                </View>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>
                  {deliveryType === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup'}
                </Text>
                <Text style={styles.timelineItemTime}>2-4 hours</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/(marketplace)/orders')}
            >
              <Text style={styles.primaryButtonText}>View My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/(marketplace)')}
            >
              <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Method</Text>

          <TouchableOpacity
            style={[styles.optionCard, deliveryType === 'pickup' && styles.optionCardActive]}
            onPress={() => setDeliveryType('pickup')}
          >
            <View style={styles.optionIcon}>
              <Package size={24} color={deliveryType === 'pickup' ? '#ff8c00' : '#64748b'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Pickup</Text>
              <Text style={styles.optionDescription}>Pick up from the vendor</Text>
            </View>
            {deliveryType === 'pickup' && <View style={styles.selectedDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, deliveryType === 'delivery' && styles.optionCardActive]}
            onPress={() => setDeliveryType('delivery')}
          >
            <View style={styles.optionIcon}>
              <Truck size={24} color={deliveryType === 'delivery' ? '#ff8c00' : '#64748b'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Delivery</Text>
              <Text style={styles.optionDescription}>Delivered to your address</Text>
            </View>
            {deliveryType === 'delivery' && <View style={styles.selectedDot} />}
          </TouchableOpacity>
        </View>

        {deliveryType === 'delivery' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#9ca3af"
              value={deliveryName}
              onChangeText={setDeliveryName}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#9ca3af"
              value={deliveryPhone}
              onChangeText={setDeliveryPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.addressInputContainer}>
              <MapPin size={20} color="#6b7280" style={styles.addressIcon} />
              <TextInput
                style={styles.addressInput}
                placeholder="Enter your delivery address (e.g., 123 Main St, Lagos, Nigeria)"
                placeholderTextColor="#9ca3af"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                multiline
                numberOfLines={3}
              />
            </View>

            {geocoding && (
              <View style={styles.geocodingStatus}>
                <ActivityIndicator size="small" color="#ff8c00" />
                <Text style={styles.geocodingText}>Calculating distance...</Text>
              </View>
            )}

            {geocodeError && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{geocodeError}</Text>
              </View>
            )}

            {geocodedCoordinates && !geocoding && (
              <View style={styles.successCard}>
                <CheckCircle size={20} color="#10b981" />
                <Text style={styles.successText}>
                  Distance: {geocodedCoordinates.lat.toFixed(2)} km from store
                </Text>
              </View>
            )}

            {calculatedDeliveryFee > 0 && (
              <View style={styles.deliveryFeeCard}>
                <Text style={styles.deliveryFeeLabel}>Calculated Delivery Fee:</Text>
                <Text style={styles.deliveryFeeValue}>₦{calculatedDeliveryFee.toFixed(2)}</Text>
              </View>
            )}

            {geocodedCoordinates && calculatedDeliveryFee === 0 && (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>Your location is outside our delivery zones. Please try a different address.</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryText}>
                  {item.product.name} x{item.quantity}
                </Text>
                <Text style={styles.summaryPrice}>
                  ₦{(item.product.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₦{calculateSubtotal().toFixed(2)}</Text>
            </View>

            {deliveryType === 'delivery' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₦{calculatedDeliveryFee.toFixed(2)}</Text>
              </View>
            )}

            {appliedPromo && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#10b981' }]}>Discount ({appliedPromo.code})</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>-₦{calculateDiscount().toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.promoSection}>
              {!appliedPromo ? (
                <>
                  <View style={styles.promoInputContainer}>
                    <TextInput
                      style={styles.promoInput}
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChangeText={(text) => {
                        setPromoCode(text.toUpperCase());
                        setPromoError('');
                      }}
                      autoCapitalize="characters"
                      editable={!applyingPromo}
                    />
                    <TouchableOpacity
                      style={[styles.applyPromoButton, applyingPromo && styles.buttonDisabled]}
                      onPress={applyPromoCode}
                      disabled={applyingPromo}
                    >
                      {applyingPromo ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.applyPromoButtonText}>Apply</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {promoError ? (
                    <Text style={styles.promoError}>{promoError}</Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.appliedPromoContainer}>
                  <View style={styles.appliedPromoInfo}>
                    <CheckCircle size={16} color="#10b981" />
                    <Text style={styles.appliedPromoText}>{appliedPromo.name}</Text>
                  </View>
                  <TouchableOpacity onPress={removePromoCode}>
                    <Text style={styles.removePromoButton}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.placeOrderButton, submitting && styles.buttonDisabled]}
          onPress={handleContinueToPayment}
          disabled={submitting}
        >
          <CreditCard size={20} color="#ffffff" style={styles.buttonIcon} />
          <Text style={styles.placeOrderButtonText}>Continue to Payment</Text>
        </TouchableOpacity>
      </View>

      {showPaymentOptions && (
        <View style={styles.paymentModal}>
          <View style={[styles.paymentModalContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Payment Method</Text>
              <TouchableOpacity
                style={styles.closeButtonContainer}
                onPress={() => setShowPaymentOptions(false)}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={styles.paymentOptionCard}
                onPress={() => {
                  fetchBankAccounts();
                  setSelectedPaymentMethod('transfer');
                }}
              >
                <View style={styles.paymentOptionIcon}>
                  <Building2 size={28} color="#ff8c00" />
                </View>
                <View style={styles.paymentOptionContent}>
                  <Text style={styles.paymentOptionTitle}>Bank Transfer</Text>
                  <Text style={styles.paymentOptionDescription}>Transfer to our bank account</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentOptionCard}
                onPress={() => setSelectedPaymentMethod('online')}
              >
                <View style={styles.paymentOptionIcon}>
                  <CreditCard size={28} color="#ff8c00" />
                </View>
                <View style={styles.paymentOptionContent}>
                  <Text style={styles.paymentOptionTitle}>Pay Online</Text>
                  <Text style={styles.paymentOptionDescription}>Pay with card or online banking</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentOptionCard}
                onPress={() => setSelectedPaymentMethod('wallet')}
              >
                <View style={styles.paymentOptionIcon}>
                  <Wallet size={28} color="#ff8c00" />
                </View>
                <View style={styles.paymentOptionContent}>
                  <Text style={styles.paymentOptionTitle}>Wallet</Text>
                  <Text style={styles.paymentOptionDescription}>Pay from your wallet balance</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentOptionCard}
                onPress={() => handlePlaceOrder('cash_on_delivery')}
                disabled={submitting}
              >
                <View style={styles.paymentOptionIcon}>
                  <Banknote size={28} color="#ff8c00" />
                </View>
                <View style={styles.paymentOptionContent}>
                  <Text style={styles.paymentOptionTitle}>Cash on Delivery</Text>
                  <Text style={styles.paymentOptionDescription}>Pay when you receive your order</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {selectedPaymentMethod === 'transfer' && (
        <View style={styles.paymentModal}>
          <View style={[styles.paymentModalContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Bank Transfer Details</Text>
              <TouchableOpacity
                style={styles.closeButtonContainer}
                onPress={() => setSelectedPaymentMethod(null)}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {loadingBankAccounts ? (
                <View style={styles.loadingBankAccounts}>
                  <ActivityIndicator size="large" color="#ff8c00" />
                  <Text style={styles.loadingText}>Loading bank accounts...</Text>
                </View>
              ) : bankAccounts.length === 0 ? (
                <View style={styles.noBankAccounts}>
                  <Building2 size={48} color="#cbd5e1" />
                  <Text style={styles.noBankAccountsText}>
                    No bank accounts available at the moment. Please use another payment method.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.amountToPayLabel}>Amount to Pay:</Text>
                  <Text style={styles.amountToPayValue}>₦{calculateTotal().toFixed(2)}</Text>

                  <Text style={styles.bankAccountsSectionTitle}>
                    Transfer to any of the accounts below:
                  </Text>

                  {bankAccounts.map((account, index) => (
                    <View key={account.id} style={styles.bankDetailsCard}>
                      <View style={styles.bankAccountHeader}>
                        <Text style={styles.bankAccountNumber}>Account {index + 1}</Text>
                      </View>

                      <View style={styles.bankDetailRow}>
                        <Text style={styles.bankDetailLabel}>Bank Name:</Text>
                        <Text style={styles.bankDetailValue}>{account.bank_name}</Text>
                      </View>

                      <View style={styles.bankDetailRow}>
                        <Text style={styles.bankDetailLabel}>Account Number:</Text>
                        <Text style={styles.bankDetailValue}>{account.account_number}</Text>
                      </View>

                      <View style={styles.bankDetailRow}>
                        <Text style={styles.bankDetailLabel}>Account Name:</Text>
                        <Text style={styles.bankDetailValue}>{account.account_name}</Text>
                      </View>

                      {account.description && (
                        <View style={styles.instructionsBox}>
                          <Text style={styles.instructionsTitle}>Important Instructions:</Text>
                          <Text style={styles.instructionsText}>{account.description}</Text>
                        </View>
                      )}
                    </View>
                  ))}

                  <View style={styles.importantNoteCard}>
                    <Text style={styles.importantNoteTitle}>Important Notes:</Text>
                    <Text style={styles.importantNoteText}>
                      • Make sure to include your Order ID in the transfer details
                    </Text>
                    <Text style={styles.importantNoteText}>
                      • Keep your payment receipt for verification
                    </Text>
                    <Text style={styles.importantNoteText}>
                      • Payment confirmation may take a few minutes
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.confirmButton, submitting && styles.buttonDisabled]}
                    onPress={() => handlePlaceOrder('transfer')}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirm & Place Order</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {selectedPaymentMethod === 'online' && !showPaymentWebView && (
        <View style={styles.paymentModal}>
          <View style={[styles.paymentModalContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Pay Online with Paystack</Text>
              <TouchableOpacity
                style={styles.closeButtonContainer}
                onPress={() => setSelectedPaymentMethod(null)}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.onlinePaymentCard}>
              <Text style={styles.onlinePaymentTitle}>Secure Online Payment</Text>
              <Text style={styles.onlinePaymentText}>
                You will be redirected to Paystack to complete your payment securely.
              </Text>
              <Text style={styles.onlinePaymentAmount}>
                Amount to Pay: ₦{calculateTotal().toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, initializingPayment && styles.buttonDisabled]}
              onPress={handlePayOnline}
              disabled={initializingPayment}
            >
              {initializingPayment ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <CreditCard size={20} color="#ffffff" style={styles.buttonIcon} />
                  <Text style={styles.confirmButtonText}>Proceed to Payment</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setSelectedPaymentMethod(null)}
            >
              <Text style={styles.secondaryButtonText}>Choose Another Method</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {selectedPaymentMethod === 'wallet' && (
        <View style={styles.paymentModal}>
          <View style={[styles.paymentModalContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Pay with Wallet</Text>
              <TouchableOpacity
                style={styles.closeButtonContainer}
                onPress={() => setSelectedPaymentMethod(null)}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.walletCard}>
              <Text style={styles.walletBalanceLabel}>Your Wallet Balance:</Text>
              <Text style={styles.walletBalanceValue}>₦{walletBalance.toFixed(2)}</Text>

              <Text style={styles.walletAmountLabel}>Amount to Pay:</Text>
              <Text style={styles.walletAmountValue}>₦{calculateTotal().toFixed(2)}</Text>
            </View>

            {walletBalance >= calculateTotal() ? (
              <>
                <Text style={styles.walletSuccessNote}>
                  You have sufficient balance to complete this payment.
                </Text>
                <TouchableOpacity
                  style={[styles.confirmButton, submitting && styles.buttonDisabled]}
                  onPress={() => handlePlaceOrder('wallet')}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Pay with Wallet</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.walletNote}>
                  Insufficient balance. You need ₦{(calculateTotal() - walletBalance).toFixed(2)} more to complete this order. Please fund your wallet or use another payment method.
                </Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setSelectedPaymentMethod(null)}
                >
                  <Text style={styles.secondaryButtonText}>Choose Another Method</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      <Modal
        visible={showPaymentWebView}
        animationType="slide"
        onRequestClose={() => {
          setShowPaymentWebView(false);
          setPaymentUrl('');
          setPaymentReference('');
        }}
      >
        {Platform.OS === 'web' ? (
          <View style={styles.paymentModal}>
            <View style={[styles.paymentModalContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentTitle}>Complete Payment</Text>
                <TouchableOpacity
                  style={styles.closeButtonContainer}
                  onPress={() => {
                    setShowPaymentWebView(false);
                    setPaymentUrl('');
                    setPaymentReference('');
                    setShowPaymentOptions(true);
                  }}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.paymentInstructionsCard}>
                <CheckCircle size={48} color="#10b981" />
                <Text style={styles.paymentInstructionsTitle}>
                  Payment Window Opened
                </Text>
                <Text style={styles.paymentInstructionsText}>
                  A new window has been opened for you to complete your payment on Paystack.
                </Text>
                <Text style={styles.paymentInstructionsText}>
                  After completing the payment, click the button below to verify and complete your order.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.confirmButton, submitting && styles.buttonDisabled]}
                onPress={handleVerifyPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>I've Completed Payment</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  if (paymentUrl) {
                    window.open(paymentUrl, '_blank');
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>Reopen Payment Window</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowPaymentWebView(false);
                  setPaymentUrl('');
                  setPaymentReference('');
                  setShowPaymentOptions(true);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.paymentModal}>
            <View style={[styles.paymentModalContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentTitle}>Complete Payment</Text>
                <TouchableOpacity
                  style={styles.closeButtonContainer}
                  onPress={() => {
                    setShowPaymentWebView(false);
                    setPaymentUrl('');
                    setPaymentReference('');
                    setShowPaymentOptions(true);
                  }}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.paymentInstructionsCard}>
                <CheckCircle size={48} color="#10b981" />
                <Text style={styles.paymentInstructionsTitle}>
                  Payment Browser Opened
                </Text>
                <Text style={styles.paymentInstructionsText}>
                  Your browser has been opened to complete your payment on Paystack.
                </Text>
                <Text style={styles.paymentInstructionsText}>
                  After completing the payment, return to this app and click the button below to verify and complete your order.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.confirmButton, submitting && styles.buttonDisabled]}
                onPress={handleVerifyPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>I've Completed Payment</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  if (paymentUrl) {
                    Linking.openURL(paymentUrl);
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>Reopen Payment Page</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowPaymentWebView(false);
                  setPaymentUrl('');
                  setPaymentReference('');
                  setShowPaymentOptions(true);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: '#999',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.headingBold,
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    letterSpacing: 0.3,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  optionCardActive: {
    borderColor: '#ff8c00',
    backgroundColor: '#fff7ed',
    borderWidth: 2,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f8f5f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  selectedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#f0ebe4',
    marginBottom: 16,
  },
  addressInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  addressIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  addressInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#1a1a1a',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  geocodingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  geocodingText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#92400e',
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#991b1b',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  successText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#065f46',
  },
  warningCard: {
    backgroundColor: '#fed7aa',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fb923c',
  },
  warningText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#9a3412',
  },
  deliveryFeeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  deliveryFeeLabel: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1e40af',
  },
  deliveryFeeValue: {
    fontSize: 20,
    fontFamily: Fonts.displayBold,
    color: '#1e40af',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    flex: 1,
  },
  summaryPrice: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1f2937',
  },
  summaryLabel: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0ebe4',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    letterSpacing: -0.5,
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
  },
  placeOrderButton: {
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  placeOrderButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
  successContent: {
    padding: 20,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: 40,
    marginBottom: 24,
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  successTitle: {
    fontSize: 32,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  successMessage: {
    fontSize: 17,
    fontFamily: Fonts.regular,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  orderDetailsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  orderDetailsTitle: {
    fontSize: 20,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
  },
  orderDetailLabel: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#64748b',
    flex: 1,
  },
  orderDetailValue: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#1e293b',
    textAlign: 'right',
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  orderTotalValue: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    letterSpacing: -0.5,
  },
  timelineCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  timelineTitle: {
    fontSize: 20,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconPending: {
    backgroundColor: '#f1f5f9',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
    marginBottom: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 20,
  },
  timelineItemTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timelineItemTime: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#94a3b8',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  secondaryButtonText: {
    color: '#ff8c00',
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
  paymentModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paymentModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentTitle: {
    fontSize: 24,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  closeButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    fontSize: 20,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    lineHeight: 20,
  },
  paymentOptions: {
    gap: 12,
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafaf8',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  paymentOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentOptionContent: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  paymentOptionDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  loadingBankAccounts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  noBankAccounts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noBankAccountsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  amountToPayLabel: {
    fontSize: 14,
    color: '#999',
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountToPayValue: {
    fontSize: 32,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    textAlign: 'center',
    marginBottom: 20,
  },
  bankAccountsSectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  bankDetailsCard: {
    backgroundColor: '#fafaf8',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  bankAccountHeader: {
    marginBottom: 12,
  },
  bankAccountNumber: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  bankDetailLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#999',
    flex: 1,
  },
  bankDetailValue: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'right',
  },
  bankDetailValueHighlight: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
  },
  instructionsBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  instructionsTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#9a3412',
    marginBottom: 6,
  },
  instructionsText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#9a3412',
    lineHeight: 18,
  },
  importantNoteCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  importantNoteTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1e40af',
    marginBottom: 10,
  },
  importantNoteText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#1e40af',
    lineHeight: 20,
    marginBottom: 4,
  },
  transferNote: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  confirmButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: Fonts.headingBold,
  },
  onlinePaymentCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  onlinePaymentTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#1e40af',
    marginBottom: 12,
  },
  onlinePaymentText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1e40af',
    lineHeight: 20,
    marginBottom: 16,
  },
  onlinePaymentAmount: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    textAlign: 'center',
  },
  walletCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  walletBalanceLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#1e40af',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletBalanceValue: {
    fontSize: 28,
    fontFamily: Fonts.displayBold,
    color: '#1e40af',
    marginBottom: 20,
  },
  walletAmountLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletAmountValue: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
  },
  walletNote: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  walletSuccessNote: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#059669',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  paymentInstructionsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#86efac',
  },
  paymentInstructionsTitle: {
    fontSize: 20,
    fontFamily: Fonts.display,
    color: '#166534',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentInstructionsText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  promoSection: {
    marginVertical: 16,
  },
  promoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  applyPromoButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPromoButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  promoError: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 8,
  },
  appliedPromoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#86efac',
  },
  appliedPromoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedPromoText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#166534',
  },
  removePromoButton: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
