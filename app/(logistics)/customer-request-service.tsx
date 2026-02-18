import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Package, Truck, X, CheckCircle, Clock, ChevronRight, ArrowUpRight, MapPin, Phone, User, AlertCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { Fonts } from '@/constants/fonts';

interface ServiceRequest {
  id: string;
  full_name: string;
  phone: string;
  pickup_area: string;
  dropoff_area: string;
  service_type: 'gadget_delivery' | 'relocation';
  status: 'pending' | 'contacted' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
}

export default function CustomerRequestService() {
  const { profile } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [serviceType, setServiceType] = useState<'gadget_delivery' | 'relocation'>('gadget_delivery');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupArea, setPickupArea] = useState('');
  const [dropoffArea, setDropoffArea] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      loadMyRequests();
    }
  }, [profile]);

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('customer_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenModal = (type: 'gadget_delivery' | 'relocation') => {
    setServiceType(type);
    setPickupArea('');
    setDropoffArea('');
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim() || !pickupArea.trim() || !dropoffArea.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('service_requests')
        .insert({
          customer_id: profile?.id,
          full_name: fullName.trim(),
          phone: phone.trim(),
          pickup_area: pickupArea.trim(),
          dropoff_area: dropoffArea.trim(),
          service_type: serviceType,
        });

      if (error) throw error;

      setModalVisible(false);
      showToast('Your request has been received. Danhausa team will contact you shortly.', 'success');
      loadMyRequests();
      setPickupArea('');
      setDropoffArea('');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      showToast(error.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getServiceTypeLabel = (type: string) => {
    return type === 'gadget_delivery' ? 'Gadget Delivery' : 'Relocation Service';
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bg: string; label: string }> = {
      pending: { color: '#d97706', bg: '#fef3c7', label: 'Pending' },
      contacted: { color: '#2563eb', bg: '#dbeafe', label: 'Contacted' },
      confirmed: { color: '#7c3aed', bg: '#ede9fe', label: 'Confirmed' },
      completed: { color: '#059669', bg: '#d1fae5', label: 'Completed' },
      cancelled: { color: '#dc2626', bg: '#fee2e2', label: 'Cancelled' },
    };
    return configs[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#1c1917', '#292524']}
        style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>LOGISTICS</Text>
          </View>
          <Text style={styles.headerTitle}>Request a Service</Text>
          <Text style={styles.headerSubtitle}>
            Fast, reliable deliveries and relocation — all handled by our expert team.
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMyRequests(); }} tintColor="#f97316" />}>

        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Choose a Service</Text>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => handleOpenModal('gadget_delivery')}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#fff7ed', '#fff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.serviceGradient}>
              <View style={styles.serviceTop}>
                <View style={[styles.serviceIconContainer, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                  <Package size={26} color="#f97316" />
                </View>
                <View style={styles.serviceArrow}>
                  <ArrowUpRight size={18} color="#f97316" />
                </View>
              </View>
              <Text style={styles.serviceTitle}>Gadget Delivery</Text>
              <Text style={styles.serviceDescription}>
                Safe and fast delivery of phones, laptops, electronics, and fragile items anywhere.
              </Text>
              <View style={styles.serviceFeatures}>
                <View style={styles.featurePill}>
                  <Text style={styles.featurePillText}>Phones & Laptops</Text>
                </View>
                <View style={styles.featurePill}>
                  <Text style={styles.featurePillText}>Fragile Items</Text>
                </View>
              </View>
              <View style={styles.serviceCta}>
                <Text style={styles.serviceCtaText}>Request Pickup</Text>
                <ChevronRight size={16} color="#f97316" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => handleOpenModal('relocation')}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#f0fdf4', '#fff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.serviceGradient}>
              <View style={styles.serviceTop}>
                <View style={[styles.serviceIconContainer, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                  <Truck size={26} color="#16a34a" />
                </View>
                <View style={[styles.serviceArrow, { backgroundColor: '#dcfce7' }]}>
                  <ArrowUpRight size={18} color="#16a34a" />
                </View>
              </View>
              <Text style={styles.serviceTitle}>Relocation Service</Text>
              <Text style={styles.serviceDescription}>
                Move your home or shop with ease. Our team handles everything from packing to delivery.
              </Text>
              <View style={styles.serviceFeatures}>
                <View style={[styles.featurePill, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                  <Text style={[styles.featurePillText, { color: '#15803d' }]}>Home Moving</Text>
                </View>
                <View style={[styles.featurePill, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                  <Text style={[styles.featurePillText, { color: '#15803d' }]}>Office Relocation</Text>
                </View>
              </View>
              <View style={[styles.serviceCta, { borderTopColor: '#bbf7d0' }]}>
                <Text style={[styles.serviceCtaText, { color: '#16a34a' }]}>Request Service</Text>
                <ChevronRight size={16} color="#16a34a" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {myRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <View style={styles.requestsSectionHeader}>
              <Text style={styles.sectionTitle}>My Requests</Text>
              <View style={styles.requestsCountBadge}>
                <Text style={styles.requestsCountText}>{myRequests.length}</Text>
              </View>
            </View>

            {myRequests.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestCardHeader}>
                    <View style={styles.requestTypeRow}>
                      <View style={[styles.requestTypeIcon, request.service_type === 'gadget_delivery' ? styles.requestTypeIconOrange : styles.requestTypeIconGreen]}>
                        {request.service_type === 'gadget_delivery'
                          ? <Package size={14} color={request.service_type === 'gadget_delivery' ? '#f97316' : '#16a34a'} />
                          : <Truck size={14} color="#16a34a" />}
                      </View>
                      <Text style={styles.requestType}>{getServiceTypeLabel(request.service_type)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>
                  </View>

                  <View style={styles.requestRoute}>
                    <View style={styles.routeRow}>
                      <View style={[styles.routeDot, styles.routeDotFrom]} />
                      <Text style={styles.routeText} numberOfLines={1}>{request.pickup_area}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <View style={[styles.routeDot, styles.routeDotTo]} />
                      <Text style={styles.routeText} numberOfLines={1}>{request.dropoff_area}</Text>
                    </View>
                  </View>

                  <View style={styles.requestFooter}>
                    <View style={styles.requestFooterLeft}>
                      <Clock size={12} color="#9ca3af" />
                      <Text style={styles.requestDate}>
                        {new Date(request.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={styles.requestFooterRight}>
                      <Phone size={12} color="#9ca3af" />
                      <Text style={styles.requestDate}>{request.phone}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalHeaderIcon,
                  serviceType === 'gadget_delivery'
                    ? { backgroundColor: '#fff7ed' }
                    : { backgroundColor: '#dcfce7' }]}>
                  {serviceType === 'gadget_delivery'
                    ? <Package size={20} color="#f97316" />
                    : <Truck size={20} color="#16a34a" />}
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {serviceType === 'gadget_delivery' ? 'Gadget Delivery' : 'Relocation Service'}
                  </Text>
                  <Text style={styles.modalSubtitle}>Fill in your details below</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                <X size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.infoBox}>
                <AlertCircle size={16} color="#2563eb" />
                <Text style={styles.infoText}>
                  Our team will call you to discuss full requirements and provide a quote.
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <User size={16} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#d1d5db"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Phone size={16} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. +234 800 000 0000"
                    placeholderTextColor="#d1d5db"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Pickup Area</Text>
                <View style={[styles.inputWrapper, styles.inputWrapperMulti]}>
                  <MapPin size={16} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={pickupArea}
                    onChangeText={setPickupArea}
                    placeholder="e.g. 10 Admiralty Way, Lekki Phase 1, Lagos"
                    placeholderTextColor="#d1d5db"
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Drop-off Area</Text>
                <View style={[styles.inputWrapper, styles.inputWrapperMulti]}>
                  <MapPin size={16} color="#f97316" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={dropoffArea}
                    onChangeText={setDropoffArea}
                    placeholder="e.g. Plot 1234, Victoria Island, Lagos"
                    placeholderTextColor="#d1d5db"
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>

              <View style={styles.successInfoBox}>
                <CheckCircle size={16} color="#059669" />
                <Text style={styles.successInfoText}>
                  After submitting, our team typically responds within 30 minutes during business hours.
                </Text>
              </View>

              <View style={{ height: 8 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled,
                  serviceType === 'relocation' && styles.submitButtonGreen]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={5000}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerContent: {
    gap: 6,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    marginBottom: 6,
  },
  headerBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsBold,
    color: '#fb923c',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
    letterSpacing: 0.3,
    lineHeight: 38,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#a8a29e',
    lineHeight: 20,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  servicesSection: {
    marginBottom: 32,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  serviceCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  serviceGradient: {
    padding: 20,
  },
  serviceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  serviceIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  serviceArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  serviceDescription: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    lineHeight: 21,
    marginBottom: 14,
  },
  serviceFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featurePill: {
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  featurePillText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#ea580c',
  },
  serviceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
    paddingTop: 14,
    gap: 4,
  },
  serviceCtaText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
    letterSpacing: 0.3,
  },
  requestsSection: {
    marginBottom: 16,
  },
  requestsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  requestsCountBadge: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  requestsCountText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  requestTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestTypeIconOrange: {
    backgroundColor: '#fff7ed',
  },
  requestTypeIconGreen: {
    backgroundColor: '#dcfce7',
  },
  requestType: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsBold,
    letterSpacing: 0.3,
  },
  requestRoute: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeDotFrom: {
    backgroundColor: '#3b82f6',
  },
  routeDotTo: {
    backgroundColor: '#f97316',
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.poppinsMedium,
    color: '#374151',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  requestFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  requestFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  requestDate: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#1e40af',
    lineHeight: 19,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  inputWrapperMulti: {
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingBottom: 8,
  },
  inputIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    paddingVertical: 12,
  },
  inputMulti: {
    minHeight: 52,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  successInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  successInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#166534',
    lineHeight: 19,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
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
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: '#f97316',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonGreen: {
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
  },
  submitButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
