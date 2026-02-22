import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Plus, Trash2, Package, MapPin, User, Phone, Navigation, Tag, Calendar, Clock, ChevronDown, ChevronUp, Layers } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { calculateDistanceBetweenAddresses } from '@/lib/geocoding';
import { pricingCalculator, Promotion } from '@/lib/pricingCalculator';
import { CheckoutModal } from './CheckoutModal';
import { PaymentMethod } from '@/lib/wallet';
import { matchAddressToZone } from '@/lib/zoneMatching';
import { Fonts } from '@/constants/fonts';

type DeliveryItem = {
  id: string;
  pickupAddress: string;
  pickupInstructions: string;
  deliveryAddress: string;
  deliveryInstructions: string;
  recipientName: string;
  recipientPhone: string;
  packageDescription: string;
  packageWeight: string;
  orderTypes: string[];
  orderSize?: 'small' | 'medium' | 'large' | '';
  distance?: number;
  price?: number;
  calculating?: boolean;
  error?: string;
  isScheduled?: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
};

type BulkOrderModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId?: string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
};

export default function BulkOrderModal({ visible, onClose, onSuccess, customerId, showToast }: BulkOrderModalProps) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([
    {
      id: '1',
      pickupAddress: '',
      pickupInstructions: '',
      deliveryAddress: '',
      deliveryInstructions: '',
      recipientName: '',
      recipientPhone: '',
      packageDescription: '',
      packageWeight: '',
      orderTypes: [],
      orderSize: '',
    },
  ]);
  const [bulkNotes, setBulkNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [validatedPromo, setValidatedPromo] = useState<Promotion | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');

  const orderTypeOptions = ['Groceries', 'Medicine', 'Express Delivery'];

  useEffect(() => {
    if (visible && customerId) {
      loadCustomerEmail();
    }
  }, [visible, customerId]);

  const loadCustomerEmail = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', customerId)
        .maybeSingle();

      if (error) throw error;
      setCustomerEmail(data?.email || '');
    } catch (err) {
      console.error('Error loading customer email:', err);
    }
  };

  const addDelivery = () => {
    const newId = (deliveries.length + 1).toString();
    setDeliveries([
      ...deliveries,
      {
        id: newId,
        pickupAddress: '',
        pickupInstructions: '',
        deliveryAddress: '',
        deliveryInstructions: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        packageWeight: '',
        orderTypes: [],
        orderSize: '',
      },
    ]);
  };

  const removeDelivery = (id: string) => {
    if (deliveries.length > 1) {
      setDeliveries(deliveries.filter(d => d.id !== id));
    }
  };

  const updateDelivery = (id: string, field: keyof DeliveryItem, value: any) => {
    setDeliveries(deliveries.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        // Only clear distance/price if address fields are changed
        if (field === 'pickupAddress' || field === 'deliveryAddress') {
          updated.distance = undefined;
          updated.price = undefined;
          updated.error = undefined;
        }
        return updated;
      }
      return d;
    }));
  };

  const toggleOrderType = async (deliveryId: string, type: string) => {
    setDeliveries(deliveries.map(d => {
      if (d.id === deliveryId) {
        const types = d.orderTypes.includes(type)
          ? d.orderTypes.filter(t => t !== type)
          : [...d.orderTypes, type];

        // If distance is already calculated, recalculate price immediately
        if (d.distance !== undefined) {
          const breakdown = pricingCalculator.calculateDeliveryPrice(d.distance, types, 0, null, d.orderSize);
          return { ...d, orderTypes: types, price: breakdown.finalPrice };
        }

        return { ...d, orderTypes: types };
      }
      return d;
    }));
  };

  const updateOrderSize = (deliveryId: string, size: 'small' | 'medium' | 'large' | '') => {
    setDeliveries(deliveries.map(d => {
      if (d.id === deliveryId) {
        // If distance is already calculated, recalculate price with new size
        if (d.distance !== undefined) {
          const breakdown = pricingCalculator.calculateDeliveryPrice(d.distance, d.orderTypes, 0, null, size);
          return { ...d, orderSize: size, price: breakdown.finalPrice };
        }

        return { ...d, orderSize: size };
      }
      return d;
    }));
  };

  useEffect(() => {
    pricingCalculator.initialize();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateAllDistances();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [deliveries.map(d => `${d.pickupAddress}-${d.deliveryAddress}-${d.orderTypes.join(',')}`).join('|')]);

  const calculateAllDistances = async () => {
    const updatedDeliveries = await Promise.all(
      deliveries.map(async (delivery) => {
        if (!delivery.pickupAddress || !delivery.deliveryAddress) {
          return { ...delivery, distance: undefined, price: undefined, calculating: false, error: undefined };
        }

        if (delivery.pickupAddress.length < 5 || delivery.deliveryAddress.length < 5) {
          return delivery;
        }

        if (delivery.distance !== undefined) {
          return delivery;
        }

        try {
          const updated = { ...delivery, calculating: true, error: undefined };
          setDeliveries(prev => prev.map(d => d.id === delivery.id ? updated : d));

          const result = await calculateDistanceBetweenAddresses(
            delivery.pickupAddress,
            delivery.deliveryAddress
          );

          if (!result) {
            return {
              ...delivery,
              calculating: false,
              error: 'Unable to find address. Use detailed addresses with landmarks',
              distance: undefined,
              price: undefined,
            };
          }

          await pricingCalculator.initialize();
          const breakdown = pricingCalculator.calculateDeliveryPrice(result.distance, delivery.orderTypes, 0, null, delivery.orderSize);

          return {
            ...delivery,
            distance: result.distance,
            price: breakdown.finalPrice,
            calculating: false,
            error: undefined,
          };
        } catch (error: any) {
          console.error('Error calculating distance:', error);
          return {
            ...delivery,
            calculating: false,
            error: error.message || 'Failed to calculate',
            distance: undefined,
            price: undefined,
          };
        }
      })
    );

    setDeliveries(updatedDeliveries);
  };

  const calculateDiscount = (count: number): number => {
    if (count >= 11) return 15;
    if (count >= 6) return 10;
    if (count >= 3) return 5;
    return 0;
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    setPromoValidating(true);
    setPromoError(null);
    setValidatedPromo(null);

    try {
      const totalFee = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
      const promotion = await pricingCalculator.validatePromoCode(
        promoCode.trim().toUpperCase(),
        customerId || '',
        totalFee
      );

      if (promotion) {
        setValidatedPromo(promotion);
        setPromoError(null);
      } else {
        setPromoError('Invalid or expired promo code');
        setValidatedPromo(null);
      }
    } catch (error: any) {
      console.error('Error validating promo:', error);
      setPromoError('Failed to validate promo code');
      setValidatedPromo(null);
    } finally {
      setPromoValidating(false);
    }
  };

  const removePromoCode = () => {
    setPromoCode('');
    setValidatedPromo(null);
    setPromoError(null);
  };

  const validateDeliveries = (): boolean => {
    for (const delivery of deliveries) {
      if (
        !delivery.pickupAddress.trim() ||
        !delivery.deliveryAddress.trim() ||
        !delivery.recipientName.trim() ||
        !delivery.recipientPhone.trim() ||
        !delivery.packageDescription.trim()
      ) {
        setError('Please fill in all required fields for each delivery');
        return false;
      }

      if (delivery.calculating) {
        setError('Please wait for distance calculations to complete');
        return false;
      }

      if (!delivery.distance || !delivery.price) {
        setError('Unable to calculate pricing. Please check addresses');
        return false;
      }
    }
    return true;
  };

  const handleProceedToCheckout = () => {
    setError(null);

    if (!validateDeliveries()) {
      return;
    }

    if (deliveries.length < 2) {
      setError('Bulk orders must have at least 2 deliveries');
      return;
    }

    setCheckoutModalVisible(true);
  };

  const handleConfirmOrder = async (paymentMethod: PaymentMethod, paystackReference?: string, scheduledTime?: Date) => {
    setLoading(true);

    try {
      const totalFee = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
      const discountPercentage = calculateDiscount(deliveries.length);
      const discountAmount = totalFee * (discountPercentage / 100);
      const afterBulkDiscount = totalFee - discountAmount;

      let promoDiscount = 0;
      let finalFee = afterBulkDiscount;

      if (validatedPromo) {
        if (validatedPromo.discount_type === 'percentage') {
          promoDiscount = afterBulkDiscount * (validatedPromo.discount_value / 100);
        } else {
          promoDiscount = validatedPromo.discount_value;
        }
        finalFee = Math.max(0, afterBulkDiscount - promoDiscount);
      }

      const bulkOrderNumber = `BULK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const { data: bulkOrder, error: bulkError } = await supabase
        .from('bulk_orders')
        .insert({
          customer_id: customerId,
          bulk_order_number: bulkOrderNumber,
          total_orders: deliveries.length,
          total_fee: totalFee,
          discount_percentage: discountPercentage,
          final_fee: finalFee,
          status: 'pending',
          notes: bulkNotes || null,
        })
        .select()
        .single();

      if (bulkError) throw bulkError;

      if (validatedPromo) {
        await pricingCalculator.incrementPromoUsage(validatedPromo.id);
      }

      const orderInserts = await Promise.all(deliveries.map(async (delivery, index) => {
        let scheduledDeliveryTime = null;
        if (delivery.isScheduled && delivery.scheduledDate && delivery.scheduledTime) {
          scheduledDeliveryTime = new Date(`${delivery.scheduledDate}T${delivery.scheduledTime}`).toISOString();
        }

        const pickupZoneId = await matchAddressToZone(delivery.pickupAddress);

        return {
          customer_id: customerId,
          bulk_order_id: bulkOrder.id,
          order_number: `ORD-${Date.now()}-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
          status: 'pending',
          pickup_address: delivery.pickupAddress,
          pickup_lat: 0,
          pickup_lng: 0,
          pickup_zone_id: pickupZoneId,
          delivery_address: delivery.deliveryAddress,
          delivery_lat: 0,
          delivery_lng: 0,
          delivery_instructions: delivery.deliveryInstructions || null,
          recipient_name: delivery.recipientName,
          recipient_phone: delivery.recipientPhone,
          package_description: delivery.packageDescription,
          package_weight: delivery.packageWeight ? parseFloat(delivery.packageWeight) : null,
          delivery_fee: delivery.price || 0,
          payment_method: paymentMethod,
          pickup_instructions: delivery.pickupInstructions || null,
          scheduled_delivery_time: scheduledDeliveryTime,
          order_size: delivery.orderSize || null,
          order_types: delivery.orderTypes.length > 0 ? delivery.orderTypes : null,
          order_source: 'logistics',
        };
      }));

      const { data: createdOrders, error: ordersError } = await supabase
        .from('orders')
        .insert(orderInserts)
        .select('id');

      if (ordersError) throw ordersError;

      if (createdOrders && createdOrders.length > 0) {
        const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/assign-rider`;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        for (const order of createdOrders) {
          try {
            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
              },
              body: JSON.stringify({ order_id: order.id }),
            });
          } catch (e) {
            console.error('Error assigning rider for bulk order:', e);
          }
        }
      }

      const promoMessage = validatedPromo ? ` & ${validatedPromo.discount_type === 'percentage' ? validatedPromo.discount_value + '%' : '₦' + validatedPromo.discount_value} promo discount` : '';
      const successMessage = `Bulk order created successfully! ${discountPercentage}% bulk discount${promoMessage} applied.`;

      if (Platform.OS === 'web' && showToast) {
        showToast(successMessage, 'success');
      } else if (Platform.OS === 'web') {
        alert(successMessage);
      }

      setDeliveries([
        {
          id: '1',
          pickupAddress: '',
          pickupInstructions: '',
          deliveryAddress: '',
          deliveryInstructions: '',
          recipientName: '',
          recipientPhone: '',
          packageDescription: '',
          packageWeight: '',
          orderTypes: [],
          orderSize: '',
        },
      ]);
      setBulkNotes('');
      setPromoCode('');
      setValidatedPromo(null);
      setPromoError(null);
      setCheckoutModalVisible(false);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating bulk order:', error);
      setError(error.message || 'Failed to create bulk order');
    } finally {
      setLoading(false);
    }
  };

  const totalCount = deliveries.length;
  const discount = calculateDiscount(totalCount);
  const totalFee = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  const bulkDiscountAmount = totalFee * (discount / 100);
  const afterBulkDiscount = totalFee - bulkDiscountAmount;

  let promoDiscount = 0;
  if (validatedPromo) {
    if (validatedPromo.discount_type === 'percentage') {
      promoDiscount = afterBulkDiscount * (validatedPromo.discount_value / 100);
    } else {
      promoDiscount = validatedPromo.discount_value;
    }
  }

  const finalFee = Math.max(0, afterBulkDiscount - promoDiscount);
  const allCalculated = deliveries.every(d => d.price !== undefined);
  const anyCalculating = deliveries.some(d => d.calculating);

  const pricingBreakdown = {
    distance: 0,
    zoneName: 'Bulk Order',
    basePrice: totalFee,
    bulkDiscount: bulkDiscountAmount,
    afterBulkDiscount: afterBulkDiscount,
    promoDiscount: promoDiscount,
    discount: bulkDiscountAmount + promoDiscount,
    finalPrice: finalFee,
    promotion: validatedPromo,
    adjustments: [],
    subtotal: totalFee,
  };

  const [expandedDelivery, setExpandedDelivery] = useState<string | null>('1');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />

          <LinearGradient colors={['#1c1917', '#292524']} style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <Layers size={20} color="#f97316" />
              </View>
              <View>
                <Text style={styles.title}>Bulk Order</Text>
                <Text style={styles.headerSubtitle}>{deliveries.length} {deliveries.length === 1 ? 'delivery' : 'deliveries'} · {discount > 0 ? `${discount}% bulk discount` : 'Add 3+ for discount'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#d6d3d1" />
            </TouchableOpacity>
          </LinearGradient>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.scrollContainer}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {deliveries.map((delivery, index) => {
              const isExpanded = expandedDelivery === delivery.id;
              return (
              <View key={delivery.id} style={[styles.deliveryCard, isExpanded && styles.deliveryCardExpanded]}>
                <TouchableOpacity
                  style={styles.deliveryHeader}
                  onPress={() => setExpandedDelivery(isExpanded ? null : delivery.id)}
                  activeOpacity={0.8}>
                  <View style={styles.deliveryHeaderLeft}>
                    <View style={[styles.deliveryNumBadge, delivery.price ? styles.deliveryNumBadgeDone : styles.deliveryNumBadgePending]}>
                      <Text style={[styles.deliveryNumText, delivery.price ? styles.deliveryNumTextDone : styles.deliveryNumTextPending]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.deliveryTitle}>Delivery #{index + 1}</Text>
                      {delivery.deliveryAddress ? (
                        <Text style={styles.deliveryPreview} numberOfLines={1}>{delivery.deliveryAddress}</Text>
                      ) : (
                        <Text style={styles.deliveryPreviewEmpty}>No address set</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.deliveryHeaderRight}>
                    {delivery.price ? (
                      <Text style={styles.deliveryPriceTag}>₦{delivery.price.toFixed(0)}</Text>
                    ) : delivery.calculating ? (
                      <ActivityIndicator size={14} color="#f97316" />
                    ) : null}
                    {deliveries.length > 1 && (
                      <TouchableOpacity onPress={() => removeDelivery(delivery.id)} style={styles.removeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={15} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                    {isExpanded ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
                  </View>
                </TouchableOpacity>

              {isExpanded && (
              <View style={styles.deliveryBody}>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pickup Address *</Text>
                  <View style={styles.inputWithIcon}>
                    <MapPin size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos"
                      value={delivery.pickupAddress}
                      onChangeText={text => updateDelivery(delivery.id, 'pickupAddress', text)}
                      multiline
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pickup Instructions (Optional)</Text>
                  <TextInput
                    style={[styles.inputSimple, styles.textArea]}
                    placeholder="e.g. Gate code, Parking info, Contact person..."
                    value={delivery.pickupInstructions}
                    onChangeText={text => updateDelivery(delivery.id, 'pickupInstructions', text)}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Delivery Address *</Text>
                  <View style={styles.inputWithIcon}>
                    <MapPin size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Plot 1234, opposite Eko Hotel, Victoria Island, Lagos"
                      value={delivery.deliveryAddress}
                      onChangeText={text => updateDelivery(delivery.id, 'deliveryAddress', text)}
                      multiline
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Delivery Instructions (Optional)</Text>
                  <TextInput
                    style={[styles.inputSimple, styles.textArea]}
                    placeholder="e.g. Call on arrival, Floor/Unit info, Security procedures..."
                    value={delivery.deliveryInstructions}
                    onChangeText={text => updateDelivery(delivery.id, 'deliveryInstructions', text)}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {(delivery.pickupAddress && delivery.deliveryAddress) && (
                  <View style={styles.distanceCard}>
                    <View style={styles.distanceHeader}>
                      <Navigation size={16} color="#f97316" />
                      <Text style={styles.distanceTitle}>Distance & Pricing</Text>
                    </View>
                    {delivery.calculating ? (
                      <View style={styles.calculatingContainer}>
                        <ActivityIndicator size="small" color="#f97316" />
                        <Text style={styles.calculatingText}>Calculating...</Text>
                      </View>
                    ) : delivery.error ? (
                      <View style={styles.distanceError}>
                        <Text style={styles.distanceErrorText}>{delivery.error}</Text>
                      </View>
                    ) : delivery.distance && delivery.price ? (
                      <View style={styles.distanceValues}>
                        <View style={styles.distanceRow}>
                          <Text style={styles.distanceLabel}>Distance:</Text>
                          <Text style={styles.distanceValue}>{delivery.distance} km</Text>
                        </View>
                        <View style={styles.distanceRow}>
                          <Text style={styles.distanceLabel}>Price:</Text>
                          <Text style={styles.priceValue}>₦{delivery.price.toFixed(2)}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Recipient Name *</Text>
                  <View style={styles.inputWithIcon}>
                    <User size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      value={delivery.recipientName}
                      onChangeText={text => updateDelivery(delivery.id, 'recipientName', text)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Recipient Phone *</Text>
                  <View style={styles.inputWithIcon}>
                    <Phone size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="+1 234 567 8900"
                      value={delivery.recipientPhone}
                      onChangeText={text => updateDelivery(delivery.id, 'recipientPhone', text)}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Package Description *</Text>
                  <View style={styles.inputWithIcon}>
                    <Package size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="Documents, Electronics, etc."
                      value={delivery.packageDescription}
                      onChangeText={text => updateDelivery(delivery.id, 'packageDescription', text)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Package Weight (kg)</Text>
                  <TextInput
                    style={styles.inputSimple}
                    placeholder="5.0"
                    value={delivery.packageWeight}
                    onChangeText={text => updateDelivery(delivery.id, 'packageWeight', text)}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Order Size (Optional)</Text>
                  <View style={styles.orderTypesContainer}>
                    {['small', 'medium', 'large'].map((size) => (
                      <TouchableOpacity
                        key={size}
                        style={[
                          styles.orderTypeChip,
                          delivery.orderSize === size && styles.orderTypeChipActive,
                        ]}
                        onPress={() => updateOrderSize(delivery.id, size as 'small' | 'medium' | 'large')}>
                        <Text
                          style={[
                            styles.orderTypeChipText,
                            delivery.orderSize === size && styles.orderTypeChipTextActive,
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
                          delivery.orderTypes.includes(type) && styles.orderTypeChipActive,
                        ]}
                        onPress={() => toggleOrderType(delivery.id, type)}>
                        <Text
                          style={[
                            styles.orderTypeChipText,
                            delivery.orderTypes.includes(type) && styles.orderTypeChipTextActive,
                          ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Delivery Time</Text>
                  <View style={styles.deliveryTimeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.timeToggleButton,
                        !delivery.isScheduled && styles.timeToggleButtonActive,
                      ]}
                      onPress={() => updateDelivery(delivery.id, 'isScheduled', false)}>
                      <Clock size={16} color={!delivery.isScheduled ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.timeToggleButtonText,
                        !delivery.isScheduled && styles.timeToggleButtonTextActive,
                      ]}>
                        Immediate
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.timeToggleButton,
                        delivery.isScheduled && styles.timeToggleButtonActive,
                      ]}
                      onPress={() => updateDelivery(delivery.id, 'isScheduled', true)}>
                      <Calendar size={16} color={delivery.isScheduled ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.timeToggleButtonText,
                        delivery.isScheduled && styles.timeToggleButtonTextActive,
                      ]}>
                        Schedule
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {delivery.isScheduled && (
                    <View style={styles.schedulingRow}>
                      <View style={styles.schedulingInput}>
                        <Text style={styles.schedulingLabel}>Date</Text>
                        <TextInput
                          style={styles.inputSimple}
                          placeholder="YYYY-MM-DD"
                          value={delivery.scheduledDate || ''}
                          onChangeText={text => updateDelivery(delivery.id, 'scheduledDate', text)}
                        />
                      </View>
                      <View style={styles.schedulingInput}>
                        <Text style={styles.schedulingLabel}>Time</Text>
                        <TextInput
                          style={styles.inputSimple}
                          placeholder="HH:MM"
                          value={delivery.scheduledTime || ''}
                          onChangeText={text => updateDelivery(delivery.id, 'scheduledTime', text)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>
              )}
              </View>
            );
            })}

            <TouchableOpacity style={styles.addButton} onPress={addDelivery}>
              <Plus size={20} color="#f97316" />
              <Text style={styles.addButtonText}>Add Another Delivery</Text>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Promo Code (Optional)</Text>
              {validatedPromo ? (
                <View style={styles.promoApplied}>
                  <View style={styles.promoAppliedLeft}>
                    <Tag size={18} color="#f97316" />
                    <View>
                      <Text style={styles.promoAppliedCode}>{validatedPromo.code}</Text>
                      <Text style={styles.promoAppliedDesc}>
                        {validatedPromo.discount_type === 'percentage'
                          ? `${validatedPromo.discount_value}% off`
                          : `₦${validatedPromo.discount_value} off`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={removePromoCode} style={styles.promoRemoveButton}>
                    <X size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.promoInputContainer}>
                  <View style={styles.promoInputWrapper}>
                    <Tag size={18} color="#6b7280" />
                    <TextInput
                      style={styles.promoInput}
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChangeText={(text) => {
                        setPromoCode(text.toUpperCase());
                        setPromoError(null);
                      }}
                      autoCapitalize="characters"
                      maxLength={20}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.applyPromoButton, promoValidating && styles.applyPromoButtonDisabled]}
                    onPress={validatePromoCode}
                    disabled={promoValidating || !promoCode.trim()}>
                    {promoValidating ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.applyPromoButtonText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {promoError && (
                <Text style={styles.promoErrorText}>{promoError}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bulk Order Notes</Text>
              <TextInput
                style={[styles.inputSimple, styles.textArea]}
                placeholder="Overall notes for this bulk order..."
                value={bulkNotes}
                onChangeText={setBulkNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                {discount > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{discount}% OFF</Text>
                  </View>
                )}
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Deliveries</Text>
                <Text style={styles.summaryValue}>{totalCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Base Fee</Text>
                <Text style={styles.summaryValue}>₦{totalFee.toFixed(2)}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bulk Discount ({discount}%)</Text>
                  <Text style={[styles.summaryValue, styles.discountText]}>-₦{bulkDiscountAmount.toFixed(2)}</Text>
                </View>
              )}
              {validatedPromo && promoDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Promo ({validatedPromo.code})</Text>
                  <Text style={[styles.summaryValue, styles.discountText]}>-₦{promoDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryDivider} />
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Final Fee</Text>
                <Text style={styles.totalValue}>₦{finalFee.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, (!allCalculated || anyCalculating) && styles.submitButtonDisabled]}
              onPress={handleProceedToCheckout}
              disabled={!allCalculated || anyCalculating}>
              <Text style={styles.submitButtonText}>
                {anyCalculating ? 'Calculating...' : !allCalculated ? 'Enter Addresses' : 'Proceed to Checkout'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <CheckoutModal
        visible={checkoutModalVisible}
        onClose={() => setCheckoutModalVisible(false)}
        onConfirm={handleConfirmOrder}
        pricing={pricingBreakdown}
        userId={customerId || ''}
        userEmail={customerEmail}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '96%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: -6,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#a8a29e',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsMedium,
    color: '#dc2626',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  discountBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  discountBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsBold,
    color: '#15803d',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppinsMedium,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
  },
  discountText: {
    color: '#16a34a',
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  deliveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  deliveryCardExpanded: {
    borderColor: '#f97316',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deliveryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deliveryNumBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryNumBadgeDone: {
    backgroundColor: '#dcfce7',
  },
  deliveryNumBadgePending: {
    backgroundColor: '#f3f4f6',
  },
  deliveryNumText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsBold,
  },
  deliveryNumTextDone: {
    color: '#15803d',
  },
  deliveryNumTextPending: {
    color: '#6b7280',
  },
  deliveryTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  deliveryPreview: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    marginTop: 2,
    maxWidth: 180,
  },
  deliveryPreviewEmpty: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#d1d5db',
    marginTop: 2,
  },
  deliveryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryPriceTag: {
    fontSize: 13,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  deliveryBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  removeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 14,
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    minHeight: 38,
  },
  inputSimple: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 11,
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'dashed',
    marginBottom: 20,
    backgroundColor: '#fff7ed',
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f97316',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  distanceCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  distanceTitle: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#16a34a',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculatingText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  distanceError: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
  },
  distanceErrorText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#dc2626',
  },
  distanceValues: {
    gap: 6,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 12,
    fontFamily: Fonts.poppinsMedium,
    color: '#6b7280',
  },
  distanceValue: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
  },
  priceValue: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  orderTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  orderTypeChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  orderTypeChipText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
  },
  orderTypeChipTextActive: {
    color: '#f97316',
  },
  promoInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  promoInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  promoInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    minHeight: 38,
  },
  applyPromoButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  applyPromoButtonDisabled: {
    opacity: 0.6,
  },
  applyPromoButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
  },
  promoApplied: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 12,
  },
  promoAppliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoAppliedCode: {
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  promoAppliedDesc: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginTop: 2,
  },
  promoRemoveButton: {
    padding: 4,
  },
  promoErrorText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsMedium,
    color: '#ef4444',
    marginTop: 6,
  },
  deliveryTimeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  timeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  timeToggleButtonActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  timeToggleButtonText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
  },
  timeToggleButtonTextActive: {
    color: '#ffffff',
  },
  schedulingRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  schedulingInput: {
    flex: 1,
    gap: 6,
  },
  schedulingLabel: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
  },
});
