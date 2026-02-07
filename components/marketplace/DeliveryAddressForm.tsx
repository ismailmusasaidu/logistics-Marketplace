import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { CheckCircle, MapPin } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryZone {
  id: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  price: number;
  is_active: boolean;
}

interface DeliveryPricing {
  default_base_price: number;
  default_price_per_km: number;
  min_delivery_charge: number;
  max_delivery_distance_km: number;
  free_delivery_threshold: number;
}

interface Promotion {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_delivery';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number;
}

interface DeliveryAddressFormProps {
  onAddressAdded?: (addressId: string, deliveryPrice: number) => void;
  orderTotal?: number;
  storeLocation?: { latitude: number; longitude: number };
}

export default function DeliveryAddressForm({
  onAddressAdded,
  orderTotal = 0,
  storeLocation = { latitude: 12.0022, longitude: 8.5919 }
}: DeliveryAddressFormProps) {
  const { profile } = useAuth();
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [geocodedCoordinates, setGeocodedCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [promotionCode, setPromotionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [pricing, setPricing] = useState<DeliveryPricing | null>(null);

  useEffect(() => {
    loadZonesAndPricing();
  }, []);

  const loadZonesAndPricing = async () => {
    const [zonesResult, pricingResult] = await Promise.all([
      supabase.from('delivery_zones').select('*').eq('is_active', true),
      supabase.from('delivery_pricing').select('*').limit(1).maybeSingle()
    ]);

    if (zonesResult.data) setZones(zonesResult.data);
    if (pricingResult.data) setPricing(pricingResult.data);
  };

  const calculateDistanceFromAddress = async () => {
    if (!addressLine1 || !city || !state) {
      setGeocodeError('Please fill in at least Address Line 1, City, and State');
      return;
    }

    try {
      setGeocoding(true);
      setGeocodeError('');

      const fullAddress = `${addressLine1}, ${addressLine2 ? addressLine2 + ', ' : ''}${city}, ${state}, ${postalCode}`;
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
          destination: fullAddress,
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
    const sortedZones = [...zones].sort((a, b) => a.min_distance_km - b.min_distance_km);

    for (const zone of sortedZones) {
      if (distance >= zone.min_distance_km && distance <= zone.max_distance_km) {
        return zone;
      }
    }
    return null;
  };

  const calculateDeliveryPrice = async () => {
    if (!geocodedCoordinates) {
      Alert.alert('Error', 'Please calculate distance first by clicking "Locate Address"');
      return;
    }

    const distance = geocodedCoordinates.lat;
    const zone = findZoneForDistance(distance);

    if (!zone) {
      Alert.alert('Error', `Delivery not available for ${distance.toFixed(2)} km. No zone covers this distance.`);
      return;
    }

    let totalPrice = zone.price;
    let zoneName = zone.name;

    let promotionDiscount = 0;
    let appliedPromotion = null;

    if (promotionCode) {
      const { data: promo } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', promotionCode.toUpperCase())
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString())
        .lte('valid_from', new Date().toISOString())
        .maybeSingle();

      if (promo && orderTotal >= promo.min_order_amount) {
        if (promo.discount_type === 'free_delivery') {
          promotionDiscount = totalPrice;
        } else if (promo.discount_type === 'percentage') {
          promotionDiscount = (totalPrice * promo.discount_value) / 100;
          if (promo.max_discount_amount && promotionDiscount > promo.max_discount_amount) {
            promotionDiscount = promo.max_discount_amount;
          }
        } else if (promo.discount_type === 'fixed_amount') {
          promotionDiscount = promo.discount_value;
        }
        appliedPromotion = promo;
      }
    }

    if (pricing && orderTotal >= pricing.free_delivery_threshold) {
      promotionDiscount = totalPrice;
    }

    const finalPrice = Math.max(0, totalPrice - promotionDiscount);

    const breakdown = {
      distance: distance.toFixed(2),
      zone: zoneName,
      zonePrice: totalPrice.toFixed(2),
      subtotal: totalPrice.toFixed(2),
      promotionDiscount: promotionDiscount.toFixed(2),
      finalPrice: finalPrice.toFixed(2),
      appliedPromotion: appliedPromotion?.name || (pricing && orderTotal >= pricing.free_delivery_threshold ? 'Free Delivery Threshold' : null),
    };

    setCalculatedPrice(finalPrice);
    setPriceBreakdown(breakdown);

    await supabase.from('delivery_logs').insert([{
      user_id: profile?.id,
      action: 'calculate',
      details: breakdown,
      zone_id: zone.id,
      distance_km: distance,
      base_price: totalPrice,
      distance_price: 0,
      promotion_discount: promotionDiscount,
      final_price: finalPrice,
    }]);
  };

  const saveAddress = async () => {
    if (!addressLine1 || !city || !state || !postalCode) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!geocodedCoordinates) {
      Alert.alert('Error', 'Please calculate distance first');
      return;
    }

    if (calculatedPrice === null) {
      Alert.alert('Error', 'Please calculate delivery price first');
      return;
    }

    setLoading(true);

    try {
      const distance = geocodedCoordinates.lat;
      const zone = findZoneForDistance(distance);

      const { data, error } = await supabase
        .from('delivery_addresses')
        .insert([{
          user_id: profile?.id,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          state,
          postal_code: postalCode,
          latitude: null,
          longitude: null,
          zone_id: zone?.id,
          distance_from_store_km: distance,
          estimated_delivery_price: calculatedPrice,
        }])
        .select()
        .single();

      if (error) throw error;

      await supabase.from('delivery_logs').insert([{
        user_id: profile?.id,
        address_id: data.id,
        action: 'address_saved',
        details: { address: data, price_breakdown: priceBreakdown },
        zone_id: zone?.id,
        distance_km: distance,
        final_price: calculatedPrice,
      }]);

      Alert.alert('Success', 'Delivery address saved successfully');

      if (onAddressAdded) {
        onAddressAdded(data.id, calculatedPrice);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Delivery Address</Text>

        <TextInput
          style={styles.input}
          placeholder="Address Line 1 *"
          value={addressLine1}
          onChangeText={setAddressLine1}
        />

        <TextInput
          style={styles.input}
          placeholder="Address Line 2 (Optional)"
          value={addressLine2}
          onChangeText={setAddressLine2}
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="City *"
            value={city}
            onChangeText={setCity}
          />

          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="State *"
            value={state}
            onChangeText={setState}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Postal Code *"
          value={postalCode}
          onChangeText={setPostalCode}
        />

        <TouchableOpacity
          style={styles.geocodeButton}
          onPress={calculateDistanceFromAddress}
          disabled={geocoding}
        >
          {geocoding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MapPin size={20} color="#fff" />
              <Text style={styles.geocodeButtonText}>Calculate Distance</Text>
            </>
          )}
        </TouchableOpacity>

        {geocodeError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{geocodeError}</Text>
          </View>
        )}

        {geocodedCoordinates && !geocoding && (
          <View style={styles.successCard}>
            <CheckCircle size={20} color="#10b981" />
            <Text style={styles.successText}>
              Distance calculated: {geocodedCoordinates.lat.toFixed(2)} km from store
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Promotion Code (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter promotion code"
          value={promotionCode}
          onChangeText={setPromotionCode}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={styles.calculateButton}
          onPress={calculateDeliveryPrice}
        >
          <Text style={styles.calculateButtonText}>Calculate Delivery Price</Text>
        </TouchableOpacity>

        {priceBreakdown && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Price Breakdown</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Distance:</Text>
              <Text style={styles.breakdownValue}>{priceBreakdown.distance} km</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Delivery Zone:</Text>
              <Text style={styles.breakdownValue}>{priceBreakdown.zone}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Zone Price:</Text>
              <Text style={styles.breakdownValue}>₦{priceBreakdown.zonePrice}</Text>
            </View>
            {parseFloat(priceBreakdown.promotionDiscount) > 0 && (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, styles.discountText]}>
                    Discount {priceBreakdown.appliedPromotion ? `(${priceBreakdown.appliedPromotion})` : ''}:
                  </Text>
                  <Text style={[styles.breakdownValue, styles.discountText]}>
                    -₦{priceBreakdown.promotionDiscount}
                  </Text>
                </View>
              </>
            )}
            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Delivery:</Text>
              <Text style={styles.totalValue}>₦{priceBreakdown.finalPrice}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (!calculatedPrice && styles.disabledButton)]}
          onPress={saveAddress}
          disabled={loading || calculatedPrice === null}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Address</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  geocodeButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  geocodeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  calculateButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff8c00',
  },
  saveButton: {
    backgroundColor: '#ff8c00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
