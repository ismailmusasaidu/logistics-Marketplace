import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Store,
  MapPin,
  CreditCard,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/fonts';

interface StoreSetupProps {
  onComplete: () => void;
}

export default function StoreSetup({ onComplete }: StoreSetupProps) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [storeData, setStoreData] = useState({
    businessName: profile?.business_name || '',
    description: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const [settingsData, setSettingsData] = useState({
    deliveryRadius: '10',
    minimumOrder: '0',
    acceptsOnlinePayment: false,
    acceptsCashOnDelivery: true,
    openingTime: '09:00',
    closingTime: '18:00',
  });

  const totalSteps = 3;
  const stepTitles = ['Store Info', 'Delivery', 'Payments'];

  const handleStoreInfoSubmit = () => {
    if (!storeData.businessName || !storeData.address) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSettingsSubmit = () => {
    if (!settingsData.deliveryRadius || !settingsData.minimumOrder) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile?.id)
        .maybeSingle();

      let vendorId = vendorData?.id;

      if (!vendorId) {
        const { data: newVendor, error: vendorError } = await supabase
          .from('vendors')
          .insert({
            user_id: profile?.id,
            business_name: storeData.businessName,
            description: storeData.description,
            address: storeData.address,
            city: storeData.city,
            state: storeData.state,
            postal_code: storeData.postalCode,
            is_verified: false,
            is_active: true,
          })
          .select()
          .single();

        if (vendorError) throw vendorError;
        vendorId = newVendor.id;
      }

      const storeHours = {
        monday: { open: settingsData.openingTime, close: settingsData.closingTime },
        tuesday: { open: settingsData.openingTime, close: settingsData.closingTime },
        wednesday: { open: settingsData.openingTime, close: settingsData.closingTime },
        thursday: { open: settingsData.openingTime, close: settingsData.closingTime },
        friday: { open: settingsData.openingTime, close: settingsData.closingTime },
        saturday: { open: settingsData.openingTime, close: settingsData.closingTime },
        sunday: { open: settingsData.openingTime, close: settingsData.closingTime },
      };

      const { error: settingsError } = await supabase.from('vendor_settings').upsert({
        vendor_id: vendorId,
        store_hours: storeHours,
        delivery_radius: parseFloat(settingsData.deliveryRadius),
        minimum_order: parseFloat(settingsData.minimumOrder),
        accepts_online_payment: settingsData.acceptsOnlinePayment,
        accepts_cash_on_delivery: settingsData.acceptsCashOnDelivery,
        is_setup_complete: true,
        updated_at: new Date().toISOString(),
      });

      if (settingsError) throw settingsError;

      onComplete();
    } catch (err: any) {
      console.error('Error setting up store:', err);
      setError(err.message || 'Failed to setup store');
    } finally {
      setLoading(false);
    }
  };

  const StepIcon = step === 1 ? Store : step === 2 ? MapPin : CreditCard;
  const stepDescriptions = [
    'Tell us about your business',
    'Configure your delivery options',
    'Choose how customers can pay',
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Set Up Your Store</Text>
        <Text style={styles.headerSub}>Step {step} of {totalSteps}</Text>
      </View>

      <View style={styles.stepBar}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, step >= s && styles.stepDotActive, step > s && styles.stepDotDone]}>
              {step > s ? (
                <Check size={12} color="#ffffff" />
              ) : (
                <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>{stepTitles[s - 1]}</Text>
            {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
          </View>
        ))}
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <StepIcon size={24} color="#ff8c00" />
            </View>
            <View>
              <Text style={styles.cardTitle}>
                {step === 1 ? 'Store Information' : step === 2 ? 'Delivery & Pricing' : 'Payment Options'}
              </Text>
              <Text style={styles.cardSub}>{stepDescriptions[step - 1]}</Text>
            </View>
          </View>

          {step === 1 && (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Business Name *</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={storeData.businessName}
                  onChangeText={(text) => setStoreData({ ...storeData, businessName: text })}
                  placeholder="Enter your business name"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={storeData.description}
                  onChangeText={(text) => setStoreData({ ...storeData, description: text })}
                  placeholder="Describe your business"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Business Address *</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={storeData.address}
                  onChangeText={(text) => setStoreData({ ...storeData, address: text })}
                  placeholder="Street address"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={storeData.city}
                    onChangeText={(text) => setStoreData({ ...storeData, city: text })}
                    placeholder="City"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>State</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={storeData.state}
                    onChangeText={(text) => setStoreData({ ...storeData, state: text })}
                    placeholder="State"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Postal Code</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={storeData.postalCode}
                  onChangeText={(text) => setStoreData({ ...storeData, postalCode: text })}
                  placeholder="Postal code"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Delivery Radius (km) *</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={settingsData.deliveryRadius}
                  onChangeText={(text) => setSettingsData({ ...settingsData, deliveryRadius: text })}
                  placeholder="10"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Minimum Order Amount ({'\u20A6'}) *</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={settingsData.minimumOrder}
                  onChangeText={(text) => setSettingsData({ ...settingsData, minimumOrder: text })}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Store Hours</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>Opening</Text>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      value={settingsData.openingTime}
                      onChangeText={(text) => setSettingsData({ ...settingsData, openingTime: text })}
                      placeholder="09:00"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>Closing</Text>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      value={settingsData.closingTime}
                      onChangeText={(text) => setSettingsData({ ...settingsData, closingTime: text })}
                      placeholder="18:00"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.form}>
              <View style={styles.switchCard}>
                <View style={styles.switchContent}>
                  <Text style={styles.switchTitle}>Accept Online Payment</Text>
                  <Text style={styles.switchDesc}>Credit/Debit cards, digital wallets</Text>
                </View>
                <Switch
                  value={settingsData.acceptsOnlinePayment}
                  onValueChange={(value) => setSettingsData({ ...settingsData, acceptsOnlinePayment: value })}
                  trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
                  thumbColor={settingsData.acceptsOnlinePayment ? '#ff8c00' : '#f8f5f0'}
                />
              </View>
              <View style={styles.switchCard}>
                <View style={styles.switchContent}>
                  <Text style={styles.switchTitle}>Cash on Delivery</Text>
                  <Text style={styles.switchDesc}>Accept cash when order is delivered</Text>
                </View>
                <Switch
                  value={settingsData.acceptsCashOnDelivery}
                  onValueChange={(value) => setSettingsData({ ...settingsData, acceptsCashOnDelivery: value })}
                  trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
                  thumbColor={settingsData.acceptsCashOnDelivery ? '#ff8c00' : '#f8f5f0'}
                />
              </View>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep(step - 1)}
                activeOpacity={0.7}
              >
                <ArrowLeft size={18} color="#64748b" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 3 ? (
              <TouchableOpacity
                style={[styles.nextBtn, step === 1 && { flex: 1 }]}
                onPress={step === 1 ? handleStoreInfoSubmit : handleSettingsSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <ArrowRight size={18} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.completeBtn, loading && { opacity: 0.6 }]}
                onPress={handleFinalSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Check size={18} color="#ffffff" />
                    <Text style={styles.completeBtnText}>Complete Setup</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  header: {
    backgroundColor: '#2d1f12',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.dmSansBold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
    marginTop: 4,
  },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#ff8c00',
  },
  stepDotDone: {
    backgroundColor: '#e67a00',
  },
  stepNum: {
    fontSize: 13,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#94a3b8',
  },
  stepNumActive: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: Fonts.dmSansMedium,
    color: '#94a3b8',
    marginLeft: 6,
  },
  stepLabelActive: {
    color: '#1a1a1a',
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#ff8c00',
  },
  body: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  cardIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
    marginTop: 2,
  },
  form: {},
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#334155',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    fontFamily: Fonts.dmSansMedium,
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f5f0',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: Fonts.dmSans,
    color: '#1a1a1a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#1a1a1a',
    marginBottom: 3,
  },
  switchDesc: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: Fonts.dmSansMedium,
    marginBottom: 16,
    textAlign: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 6,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#64748b',
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  nextBtnText: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#ffffff',
  },
  completeBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d1f12',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  completeBtnText: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#ffffff',
  },
});
