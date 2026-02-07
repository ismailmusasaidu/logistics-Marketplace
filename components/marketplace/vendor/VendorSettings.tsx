import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  Image,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Save, Store, Upload, Image as ImageIcon, X, CreditCard, Clock, Share2, Truck, MapPin, DollarSign } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

interface VendorSettingsData {
  id: string;
  vendor_id: string;
  delivery_radius: number;
  minimum_order: number;
  accepts_online_payment: boolean;
  accepts_cash_on_delivery: boolean;
  store_banner_url: string | null;
  store_hours: Record<string, { open: string; close: string; closed: boolean }>;
  social_media: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function VendorSettings() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VendorSettingsData | null>(null);

  const [deliveryRadius, setDeliveryRadius] = useState('10');
  const [minimumOrder, setMinimumOrder] = useState('0');
  const [acceptsOnlinePayment, setAcceptsOnlinePayment] = useState(false);
  const [acceptsCashOnDelivery, setAcceptsCashOnDelivery] = useState(true);
  const [storeBannerUrl, setStoreBannerUrl] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [storeHours, setStoreHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>({});

  useEffect(() => {
    if (profile?.role === 'vendor') {
      fetchVendorSettings();
    }
  }, [profile]);

  const fetchVendorSettings = async () => {
    if (!profile) return;

    try {
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (vendorError) throw vendorError;
      if (!vendorData) {
        showToast('Vendor profile not found', 'error');
        setLoading(false);
        return;
      }

      setVendorId(vendorData.id);

      const { data: settingsData, error: settingsError } = await supabase
        .from('vendor_settings')
        .select('*')
        .eq('vendor_id', vendorData.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

      if (settingsData) {
        setSettings(settingsData);
        setDeliveryRadius(settingsData.delivery_radius?.toString() || '10');
        setMinimumOrder(settingsData.minimum_order?.toString() || '0');
        setAcceptsOnlinePayment(settingsData.accepts_online_payment || false);
        setAcceptsCashOnDelivery(settingsData.accepts_cash_on_delivery ?? true);
        setStoreBannerUrl(settingsData.store_banner_url || '');

        const socialMedia = settingsData.social_media || {};
        setFacebook(socialMedia.facebook || '');
        setInstagram(socialMedia.instagram || '');
        setTwitter(socialMedia.twitter || '');
        setWhatsapp(socialMedia.whatsapp || '');

        const hours = settingsData.store_hours || {};
        const defaultHours: Record<string, { open: string; close: string; closed: boolean }> = {};
        DAYS.forEach(day => {
          defaultHours[day] = hours[day] || { open: '09:00', close: '17:00', closed: false };
        });
        setStoreHours(defaultHours);
      } else {
        const defaultHours: Record<string, { open: string; close: string; closed: boolean }> = {};
        DAYS.forEach(day => {
          defaultHours[day] = { open: '09:00', close: '17:00', closed: false };
        });
        setStoreHours(defaultHours);
      }
    } catch (error) {
      console.error('Error fetching vendor settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadBanner = async () => {
    if (!vendorId) {
      showToast('Vendor ID not found', 'error');
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        showToast('Permission to access media library is required', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const image = result.assets[0];
      setUploading(true);

      const fileExt = image.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${vendorId}/${Date.now()}.${fileExt}`;

      let fileData: Blob | ArrayBuffer;

      if (Platform.OS === 'web') {
        const response = await fetch(image.uri);
        fileData = await response.blob();
      } else {
        const response = await fetch(image.uri);
        fileData = await response.arrayBuffer();
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vendor-banners')
        .upload(fileName, fileData, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vendor-banners')
        .getPublicUrl(fileName);

      setStoreBannerUrl(publicUrl);

      if (settings) {
        const { error: updateError } = await supabase
          .from('vendor_settings')
          .update({
            store_banner_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('vendor_settings')
          .insert({
            vendor_id: vendorId,
            delivery_radius: parseFloat(deliveryRadius) || 10,
            minimum_order: parseFloat(minimumOrder) || 0,
            accepts_online_payment: acceptsOnlinePayment,
            accepts_cash_on_delivery: acceptsCashOnDelivery,
            store_banner_url: publicUrl,
            social_media: {},
            store_hours: storeHours,
          });

        if (insertError) throw insertError;
      }

      showToast('Banner uploaded and saved successfully', 'success');
      await fetchVendorSettings();
    } catch (error) {
      console.error('Error uploading banner:', error);
      showToast('Failed to upload banner', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!vendorId) {
      showToast('Vendor ID not found', 'error');
      return;
    }

    const radius = parseFloat(deliveryRadius);
    const minOrder = parseFloat(minimumOrder);

    if (isNaN(radius) || radius < 0) {
      showToast('Please enter a valid delivery radius', 'warning');
      return;
    }

    if (isNaN(minOrder) || minOrder < 0) {
      showToast('Please enter a valid minimum order amount', 'warning');
      return;
    }

    setSaving(true);
    try {
      const updatedSettings = {
        vendor_id: vendorId,
        delivery_radius: radius,
        minimum_order: minOrder,
        accepts_online_payment: acceptsOnlinePayment,
        accepts_cash_on_delivery: acceptsCashOnDelivery,
        store_banner_url: storeBannerUrl || null,
        social_media: {
          facebook: facebook || undefined,
          instagram: instagram || undefined,
          twitter: twitter || undefined,
          whatsapp: whatsapp || undefined,
        },
        store_hours: storeHours,
        updated_at: new Date().toISOString(),
      };

      if (settings) {
        const { error } = await supabase
          .from('vendor_settings')
          .update(updatedSettings)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vendor_settings')
          .insert(updatedSettings);

        if (error) throw error;
      }

      showToast('Settings saved successfully!', 'success');
      fetchVendorSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateStoreHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setStoreHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIconWrap}>
              <Store size={26} color="#ff8c00" strokeWidth={2.5} />
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Store Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your store settings and preferences</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Truck size={18} color="#ff8c00" strokeWidth={2.2} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Delivery Settings</Text>
            <Text style={styles.sectionDescription}>Configure delivery area and requirements</Text>
          </View>
        </View>
        <View style={styles.sectionCard}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <MapPin size={14} color="#64748b" />
              <Text style={styles.label}>Delivery Radius</Text>
            </View>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={[styles.input, styles.inputWithUnitField, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                value={deliveryRadius}
                onChangeText={setDeliveryRadius}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.inputUnit}>km</Text>
            </View>
            <Text style={styles.helperText}>Maximum distance for order delivery from your store</Text>
          </View>
          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <View style={styles.labelRow}>
              <DollarSign size={14} color="#64748b" />
              <Text style={styles.label}>Minimum Order Amount</Text>
            </View>
            <View style={styles.inputWithUnit}>
              <Text style={styles.inputPrefix}>{'\u20A6'}</Text>
              <TextInput
                style={[styles.input, styles.inputWithPrefix, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                value={minimumOrder}
                onChangeText={setMinimumOrder}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <Text style={styles.helperText}>Minimum cart value required for checkout</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <CreditCard size={18} color="#ff8c00" strokeWidth={2.2} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <Text style={styles.sectionDescription}>Choose accepted payment options</Text>
          </View>
        </View>
        <View style={styles.sectionCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>Online Payment</Text>
              <Text style={styles.switchDescription}>Accept digital payments via Paystack</Text>
            </View>
            <Switch
              value={acceptsOnlinePayment}
              onValueChange={setAcceptsOnlinePayment}
              trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
              thumbColor={acceptsOnlinePayment ? '#ff8c00' : '#cbd5e1'}
              ios_backgroundColor="#e2e8f0"
            />
          </View>
          <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>Cash on Delivery</Text>
              <Text style={styles.switchDescription}>Accept cash when order is delivered</Text>
            </View>
            <Switch
              value={acceptsCashOnDelivery}
              onValueChange={setAcceptsCashOnDelivery}
              trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
              thumbColor={acceptsCashOnDelivery ? '#ff8c00' : '#cbd5e1'}
              ios_backgroundColor="#e2e8f0"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <ImageIcon size={18} color="#ff8c00" strokeWidth={2.2} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Store Banner</Text>
            <Text style={styles.sectionDescription}>Add a visual banner to your storefront</Text>
          </View>
        </View>
        <View style={styles.sectionCard}>
          {storeBannerUrl ? (
            <View style={styles.bannerPreview}>
              <Image
                source={{ uri: storeBannerUrl }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
              <View style={styles.bannerOverlay}>
                <TouchableOpacity
                  style={styles.removeBannerBtn}
                  onPress={() => setStoreBannerUrl('')}
                  activeOpacity={0.8}
                >
                  <X size={16} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noBannerPreview}>
              <View style={styles.noBannerIconWrap}>
                <ImageIcon size={40} color="#cbd5e1" strokeWidth={1.5} />
              </View>
              <Text style={styles.noBannerText}>No banner uploaded yet</Text>
              <Text style={styles.noBannerSubtext}>Recommended size: 1200 × 600 pixels</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
            onPress={pickAndUploadBanner}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.uploadBtnText}>Uploading Banner...</Text>
              </>
            ) : (
              <>
                <Upload size={18} color="#fff" strokeWidth={2.5} />
                <Text style={styles.uploadBtnText}>
                  {storeBannerUrl ? 'Change Banner' : 'Upload Banner'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <Text style={styles.label}>Enter Image URL</Text>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              value={storeBannerUrl}
              onChangeText={setStoreBannerUrl}
              placeholder="https://example.com/banner.jpg"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Clock size={18} color="#ff8c00" strokeWidth={2.2} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Store Hours</Text>
            <Text style={styles.sectionDescription}>Set your weekly operating schedule</Text>
          </View>
        </View>
        <View style={styles.sectionCard}>
          {DAYS.map((day, index) => (
            <View key={day} style={[styles.dayRow, index === DAYS.length - 1 && { marginBottom: 0 }]}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{day}</Text>
                <View style={styles.closedSwitch}>
                  <Text style={styles.closedLabel}>Closed</Text>
                  <Switch
                    value={storeHours[day]?.closed || false}
                    onValueChange={(value) => updateStoreHours(day, 'closed', value)}
                    trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
                    thumbColor={storeHours[day]?.closed ? '#ff8c00' : '#f8f5f0'}
                  />
                </View>
              </View>
              {!storeHours[day]?.closed && (
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={styles.timeLabel}>Open</Text>
                    <TextInput
                      style={[styles.input, styles.timeField, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      value={storeHours[day]?.open || '09:00'}
                      onChangeText={(value) => updateStoreHours(day, 'open', value)}
                      placeholder="09:00"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={styles.timeLabel}>Close</Text>
                    <TextInput
                      style={[styles.input, styles.timeField, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      value={storeHours[day]?.close || '17:00'}
                      onChangeText={(value) => updateStoreHours(day, 'close', value)}
                      placeholder="17:00"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Share2 size={18} color="#ff8c00" strokeWidth={2.2} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Social Media</Text>
            <Text style={styles.sectionDescription}>Connect your social media accounts</Text>
          </View>
        </View>
        <View style={styles.sectionCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Facebook</Text>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              value={facebook}
              onChangeText={setFacebook}
              placeholder="https://facebook.com/yourstore"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Instagram</Text>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              value={instagram}
              onChangeText={setInstagram}
              placeholder="https://instagram.com/yourstore"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Twitter</Text>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              value={twitter}
              onChangeText={setTwitter}
              placeholder="https://twitter.com/yourstore"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <Text style={styles.label}>WhatsApp</Text>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="+234XXXXXXXXXX"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.saveBtnText}>Saving Changes...</Text>
            </>
          ) : (
            <>
              <Save size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>Save All Changes</Text>
            </>
          )}
        </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconContainer: {
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.dmSans,
    color: '#64748b',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  sectionTitleContainer: {
    flex: 1,
    paddingTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#64748b',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#1a1a1a',
    letterSpacing: -0.1,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: Fonts.dmSans,
    color: '#1a1a1a',
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputWithUnitField: {
    flex: 1,
    paddingRight: 50,
  },
  inputUnit: {
    position: 'absolute',
    right: 18,
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#64748b',
  },
  inputPrefix: {
    position: 'absolute',
    left: 18,
    fontSize: 16,
    fontFamily: Fonts.dmSansBold,
    color: '#64748b',
    zIndex: 1,
  },
  inputWithPrefix: {
    paddingLeft: 36,
  },
  helperText: {
    fontSize: 12,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
    marginTop: 8,
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  switchDescription: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#64748b',
    lineHeight: 18,
  },
  dayRow: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayName: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#1a1a1a',
    letterSpacing: -0.1,
  },
  closedSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closedLabel: {
    fontSize: 13,
    fontFamily: Fonts.dmSansMedium,
    color: '#64748b',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timeField: {
    padding: 12,
  },
  bannerPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  removeBannerBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(45,31,18,0.85)',
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  noBannerPreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noBannerIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f8f5f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noBannerText: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#475569',
    marginBottom: 4,
  },
  noBannerSubtext: {
    fontSize: 12,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d1f12',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
    marginBottom: 20,
    shadowColor: '#2d1f12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.dmSansBold,
    letterSpacing: 0.2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 11,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  saveButtonContainer: {
    marginTop: 32,
    marginHorizontal: 20,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.dmSansBold,
    letterSpacing: 0.3,
  },
});
