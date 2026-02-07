import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, Phone, ShieldOff, ShieldCheck, Filter } from 'lucide-react-native';
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
}

export default function AdminRiders() {
  const { profile } = useAuth();
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
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
  }, []);

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, is_suspended, suspended_at, suspended_by, created_at')
        .eq('role', 'rider')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error('Error loading riders:', error);
      showToast('Failed to load riders', 'error');
    } finally {
      setRefreshing(false);
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
    if (filter === 'active') return !rider.is_suspended;
    if (filter === 'suspended') return rider.is_suspended;
    return true;
  });

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
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
              onPress={() => setFilter('all')}>
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRiders(); }} />}>

        {filteredRiders.length === 0 ? (
          <View style={styles.emptyState}>
            <Bike size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No riders found</Text>
            <Text style={styles.emptySubtext}>Riders will appear here</Text>
          </View>
        ) : (
          filteredRiders.map((rider) => (
            <View key={rider.id} style={styles.riderCard}>
              <View style={styles.riderHeader}>
                <View style={styles.riderInfo}>
                  <View style={[styles.avatar, rider.is_suspended && styles.avatarSuspended]}>
                    <Bike size={24} color="#ffffff" />
                  </View>
                  <View style={styles.riderDetails}>
                    <Text style={styles.riderName}>{rider.full_name || 'Unknown'}</Text>
                    <Text style={styles.riderEmail}>{rider.email}</Text>
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  rider.is_suspended ? styles.statusBadgeSuspended : styles.statusBadgeActive,
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    rider.is_suspended ? styles.statusTextSuspended : styles.statusTextActive,
                  ]}>
                    {rider.is_suspended ? 'Suspended' : 'Active'}
                  </Text>
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
                  <Bike size={14} color="#6b7280" />
                  <Text style={styles.infoLabel}>Joined</Text>
                  <Text style={styles.infoValue}>{formatDate(rider.created_at)}</Text>
                </View>
              </View>

              <View style={styles.actions}>
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
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
  filterButtonActive: {
    backgroundColor: '#f97316',
  },
  filterButtonSuspended: {
    backgroundColor: '#ef4444',
  },
  filterText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
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
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSuspended: {
    backgroundColor: '#9ca3af',
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#fff7ed',
  },
  statusBadgeSuspended: {
    backgroundColor: '#fef2f2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  statusTextActive: {
    color: '#f97316',
  },
  statusTextSuspended: {
    color: '#ef4444',
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
  actions: {
    flexDirection: 'row',
    gap: 12,
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
});
