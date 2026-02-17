import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryAddressFormProps {
  onAddressAdded?: (addressId: string, deliveryPrice: number) => void;
  orderTotal?: number;
}

export default function DeliveryAddressForm({
  onAddressAdded,
  orderTotal = 0,
}: DeliveryAddressFormProps) {
  const { profile } = useAuth();
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);

  const saveAddress = async () => {
    if (!addressLine1 || !city || !state || !postalCode) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
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
          zone_id: null,
          distance_from_store_km: null,
          estimated_delivery_price: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      Alert.alert('Success', 'Delivery address saved successfully');

      if (onAddressAdded) {
        onAddressAdded(data.id, 0);
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
          placeholderTextColor="#aaa"
        />

        <TextInput
          style={styles.input}
          placeholder="Address Line 2 (Optional)"
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholderTextColor="#aaa"
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="City *"
            value={city}
            onChangeText={setCity}
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="State *"
            value={state}
            onChangeText={setState}
            placeholderTextColor="#aaa"
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Postal Code *"
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="numeric"
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveAddress}
          disabled={loading}
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
    backgroundColor: '#f8f5f0',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#f0ebe4',
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#ff8c00',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
