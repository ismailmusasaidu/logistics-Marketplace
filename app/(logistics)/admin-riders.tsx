import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bike, Phone, ShieldOff, ShieldCheck, Filter, CheckCircle, XCircle, Eye, AlertCircle, MapPin, Calendar, Wifi } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Fonts } from '@/constants/fonts';

interface RiderProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  created_at: string;
  vendor_status: 'pending' | 'approved' | 'rejected' | null;
  rejection_reason: string | null;
  rider_status: 'online' | 'offline' | null;
}

interface RiderDetails extends RiderProfile {
  total_deliveries: number;
  rating: number;
  zone_id: string | null;
  zone_name: string | null;
}

export default function AdminRiders() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const [selectedRider, setSelectedRider] = useState<RiderDetails | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [riderToReject, setRiderToReject] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    loadRiders();

    const channel = supabase
      .channel('admin-riders-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, () => {
        loadRiders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, is_suspended, suspended_at, suspended_by, created_at, vendor_status, rejection_reason, riders(status)')
        .eq('role', 'rider')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((p: any) => ({
        ...p,
        rider_status: Array.isArray(p.riders) ? (p.riders[0]?.status ?? null) : (p.riders?.status ?? null),
      }));

      setRiders(mapped);
    } catch (error) {
      console.error('Error loading riders:', error);
      showToast('Failed to load riders', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadRiderDetails = async (riderId: string) => {
    try {
      setLoading(true);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', riderId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        throw new Error('Rider profile not found');
      }

      const riderRes = await supabase
        .from('riders')
        .select('rating, zone_id, total_deliveries, zones(name)')
        .eq('user_id', riderId)
        .maybeSingle();

      if (riderRes.error) {
        console.error('Error loading rider data:', riderRes.error);
      }

      let zoneName = null;
      if (riderRes.data?.zones && typeof riderRes.data.zones === 'object' && 'name' in riderRes.data.zones) {
        zoneName = (riderRes.data.zones as any).name;
      }

      const details: RiderDetails = {
        ...profileData,
        total_deliveries: riderRes.data?.total_deliveries ?? 0,
        rating: riderRes.data?.rating || 0,
        zone_id: riderRes.data?.zone_id || null,
        zone_name: zoneName,
      };

      setSelectedRider(details);
      setDetailsModalVisible(true);
    } catch (error) {
      console.error('Error loading rider details:', error);
      showToast('Failed to load rider details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (rider: RiderProfile) => {
    setConfirmDialog({
      visible: true,
      title: 'Approve Rider',
      message: `Are you sure you want to approve ${rider.full_name || 'this rider'}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ vendor_status: 'approved', rejection_reason: null })
            .eq('id', rider.id);

          if (error) throw error;
          showToast('Rider approved successfully', 'success');
          loadRiders();
        } catch (error) {
          console.error('Error approving rider:', error);
          showToast('Failed to approve rider', 'error');
        }
      },
    });
  };

  const handleRejectClick = (rider: RiderProfile) => {
    setRiderToReject(rider);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!riderToReject) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ vendor_status: 'rejected', rejection_reason: rejectionReason.trim() })
        .eq('id', riderToReject.id);

      if (error) throw error;
      showToast('Rider application rejected', 'success');
      setRejectModalVisible(false);
      setRiderToReject(null);
      setRejectionReason('');
      loadRiders();
    } catch (error) {
      console.error('Error rejecting rider:', error);
      showToast('Failed to reject rider', 'error');
    }
  };

  const handleToggleSuspend = (rider: RiderProfile) => {
    const action = rider.is_suspended ? 'unsuspend' : 'suspend';
    setConfirmDialog({
      visible: true,
      title: `${rider.is_suspended ? 'Unsuspend' : 'Suspend'} Rider`,
      message: `Are you sure you want to ${action} ${rider.full_name || 'this rider'}?`,
      onConfirm: async () => {
        try {
          const updateData = rider.is_suspended
            ? { is_suspended: false, suspended_at: null, suspended_by: null }
            : { is_suspended: true, suspended_at: new Date().toISOString(), suspended_by: profile?.id || null };

          const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', rider.id);

          if (error) throw error;
          showToast(`Rider ${action}ed successfully`, 'success');
          loadRiders();
        } catch (error) {
          console.error(`Error ${action}ing rider:`, error);
          showToast(`Failed to ${action} rider`, 'error');
        }
      },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredRiders = riders.filter((rider) => {
    if (filter === 'pending') return rider.vendor_status === 'pending';
    if (filter === 'active') return !rider.is_suspended && rider.vendor_status === 'approved';
    if (filter === 'suspended') return rider.is_suspended;
    return true;
  });

  const getStatusBadge = (rider: RiderProfile) => {
    if (rider.vendor_status === 'pending') {
      return { text: 'Pending', color: '#fbbf24', bg: '#fef3c7' };
    }
    if (rider.vendor_status === 'rejected') {
      return { text: 'Rejected', color: '#ef4444', bg: '#fee2e2' };
    }
    if (rider.is_suspended) {
      return { text: 'Suspended', color: '#6b7280', bg: '#f3f4f6' };
    }
    return { text: 'Active', color: '#10b981', bg: '#d1fae5' };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Riders</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{riders.length}</Text>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Filter size={18} color="#6b7280" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.filterButtonAll]}
              onPress={() => setFilter('all')}>
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextAll]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'pending' && styles.filterButtonPending]}
              onPress={() => setFilter('pending')}>
              <Text style={[styles.filterText, filter === 'pending' && styles.filterTextPending]}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
              onPress={() => setFilter('active')}>
              <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'suspended' && styles.filterButtonSuspended]}
              onPress={() => setFilter('suspended')}>
              <Text style={[styles.filterText, filter === 'suspended' && styles.filterTextSuspended]}>Suspended</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRiders(); }} />}>

        {filteredRiders.length === 0 ? (
          <View style={styles.emptyState}>
            <Bike size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No riders found</Text>
            <Text style={styles.emptySubtext}>Riders will appear here</Text>
          </View>
        ) : (
          filteredRiders.map((rider) => {
            const status = getStatusBadge(rider);
            const isPending = rider.vendor_status === 'pending';
            const isRejected = rider.vendor_status === 'rejected';

            return (
              <View key={rider.id} style={styles.riderCard}>
                <View style={styles.riderHeader}>
                  <View style={styles.riderInfo}>
                    <View style={[
                      styles.avatar,
                      rider.is_suspended && styles.avatarSuspended,
                      isPending && styles.avatarPending,
                      isRejected && styles.avatarRejected
                    ]}>
                      <Bike size={24} color="#ffffff" />
                    </View>
                    <View style={styles.riderDetails}>
                      <Text style={styles.riderName}>{rider.full_name || 'Unknown'}</Text>
                      <Text style={styles.riderEmail}>{rider.email}</Text>
                    </View>
                  </View>
                  <View style={styles.badgesColumn}>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: status.color }]}>
                        {status.text}
                      </Text>
                    </View>
                    {rider.vendor_status === 'approved' && !rider.is_suspended && (
                      <View style={[
                        styles.onlineBadge,
                        rider.rider_status === 'online' ? styles.onlineBadgeActive : styles.onlineBadgeInactive,
                      ]}>
                        <View style={[
                          styles.onlineDot,
                          rider.rider_status === 'online' ? styles.onlineDotActive : styles.onlineDotInactive,
                        ]} />
                        <Text style={[
                          styles.onlineBadgeText,
                          rider.rider_status === 'online' ? styles.onlineBadgeTextActive : styles.onlineBadgeTextInactive,
                        ]}>
                          {rider.rider_status === 'online' ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.infoSection}>
                  {rider.phone && (
                    <View style={styles.infoRow}>
                      <Phone size={14} color="#6b7280" />
                      <Text style={styles.infoLabel}>Phone</Text>
                      <Text style={styles.infoValue}>{rider.phone}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Calendar size={14} color="#6b7280" />
                    <Text style={styles.infoLabel}>Joined</Text>
                    <Text style={styles.infoValue}>{formatDate(rider.created_at)}</Text>
                  </View>
                  {isRejected && rider.rejection_reason && (
                    <View style={styles.rejectionInfo}>
                      <AlertCircle size={14} color="#ef4444" />
                      <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                      <Text style={styles.rejectionText}>{rider.rejection_reason}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.detailsButton}
                    onPress={() => loadRiderDetails(rider.id)}
                    disabled={loading}>
                    <Eye size={18} color="#6b7280" />
                    <Text style={styles.detailsButtonText}>View Details</Text>
                  </TouchableOpacity>

                  {isPending ? (
                    <>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApprove(rider)}>
                        <CheckCircle size={18} color="#10b981" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleRejectClick(rider)}>
                        <XCircle size={18} color="#ef4444" />
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  ) : !isRejected && (
                    <TouchableOpacity
                      style={[
                        styles.suspendButton,
                        rider.is_suspended ? styles.unsuspendButton : styles.suspendButtonDanger,
                      ]}
                      onPress={() => handleToggleSuspend(rider)}>
                      {rider.is_suspended ? (
                        <ShieldCheck size={18} color="#f97316" />
                      ) : (
                        <ShieldOff size={18} color="#ef4444" />
                      )}
                      <Text style={[
                        styles.suspendButtonText,
                        rider.is_suspended ? styles.unsuspendButtonText : styles.suspendButtonTextDanger,
                      ]}>
                        {rider.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rider Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <XCircle size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedRider && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Personal Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Full Name</Text>
                    <Text style={styles.detailValue}>{selectedRider.full_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{selectedRider.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{selectedRider.phone || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Joined</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedRider.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Performance</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Deliveries</Text>
                    <Text style={styles.detailValue}>{selectedRider.total_deliveries}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rating</Text>
                    <Text style={styles.detailValue}>{selectedRider.rating.toFixed(1)} / 5.0</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Zone</Text>
                    <Text style={styles.detailValue}>{selectedRider.zone_name || 'Not Assigned'}</Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Account Status</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Application Status</Text>
                    <Text style={[styles.detailValue, { color: getStatusBadge(selectedRider).color }]}>
                      {selectedRider.vendor_status || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Suspended</Text>
                    <Text style={styles.detailValue}>{selectedRider.is_suspended ? 'Yes' : 'No'}</Text>
                  </View>
                  {selectedRider.rejection_reason && (
                    <View style={styles.rejectionDetailBox}>
                      <Text style={styles.rejectionDetailLabel}>Rejection Reason:</Text>
                      <Text style={styles.rejectionDetailText}>{selectedRider.rejection_reason}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={rejectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Rider Application</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <XCircle size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.rejectModalText}>
              Please provide a reason for rejecting {riderToReject?.full_name || 'this rider'}.
            </Text>

            <TextInput
              style={styles.textArea}
              placeholder="Enter rejection reason..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              textAlignVertical="top"
            />

            <View style={styles.rejectModalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRejectButton}
                onPress={handleRejectConfirm}>
                <Text style={styles.confirmRejectButtonText}>Reject Application</Text>
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

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  badge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterScroll: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonAll: {
    backgroundColor: '#3b82f6',
  },
  filterButtonPending: {
    backgroundColor: '#fbbf24',
  },
  filterButtonActive: {
    backgroundColor: '#10b981',
  },
  filterButtonSuspended: {
    backgroundColor: '#6b7280',
  },
  filterText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  filterTextAll: {
    color: '#ffffff',
  },
  filterTextPending: {
    color: '#ffffff',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  filterTextSuspended: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    marginTop: 4,
  },
  riderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  riderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarPending: {
    backgroundColor: '#fbbf24',
  },
  avatarSuspended: {
    backgroundColor: '#6b7280',
  },
  avatarRejected: {
    backgroundColor: '#ef4444',
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 2,
  },
  riderEmail: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  badgesColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  onlineBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  onlineBadgeInactive: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onlineDotActive: {
    backgroundColor: '#059669',
  },
  onlineDotInactive: {
    backgroundColor: '#9ca3af',
  },
  onlineBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
  onlineBadgeTextActive: {
    color: '#059669',
  },
  onlineBadgeTextInactive: {
    color: '#6b7280',
  },
  infoSection: {
    gap: 10,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  rejectionInfo: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#991b1b',
  },
  rejectionText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#dc2626',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailsButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  detailsButtonText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  approveButton: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
  },
  approveButtonText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#10b981',
  },
  rejectButton: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  rejectButtonText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
  suspendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  suspendButtonDanger: {
    backgroundColor: '#fef2f2',
  },
  unsuspendButton: {
    backgroundColor: '#fff7ed',
  },
  suspendButtonText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  suspendButtonTextDanger: {
    color: '#ef4444',
  },
  unsuspendButtonText: {
    color: '#f97316',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  rejectionDetailBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  rejectionDetailLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#991b1b',
    marginBottom: 4,
  },
  rejectionDetailText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#dc2626',
    lineHeight: 18,
  },
  rejectModalText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#111827',
    minHeight: 100,
    marginBottom: 20,
  },
  rejectModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  confirmRejectButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmRejectButtonText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
