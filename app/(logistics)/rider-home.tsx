import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, Package, CheckCircle, Clock, AlertCircle, MapPin, Phone, User, X, Bell, Check, XCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';
import { Toast } from '@/components/Toast';

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  delivery_address: string | null;
  pickup_address: string | null;
  delivery_fee: number;
  created_at: string;
  customer?: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

type PendingAssignment = {
  id: string;
  order_number: string;
  pickup_address: string | null;
  delivery_address: string | null;
  delivery_fee: number;
  assignment_timeout_at: string;
  created_at: string;
  customer?: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

type RiderStats = {
  total_deliveries: number;
  status: string;
};

export default function RiderHome() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [riderStats, setRiderStats] = useState<RiderStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [processingAssignment, setProcessingAssignment] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
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
    if (pendingAssignments.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pendingAssignments.length]);

  useEffect(() => {
    if (profile?.id) {
      loadRiderId();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (riderId) {
      loadData();
      loadPendingAssignments();

      const channel = supabase
        .channel('rider-assignments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `assigned_rider_id=eq.${riderId}`,
          },
          () => {
            loadPendingAssignments();
            loadOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [riderId]);

  useEffect(() => {
    if (pendingAssignments.length > 0) {
      const newCountdowns: Record<string, number> = {};
      pendingAssignments.forEach(assignment => {
        const timeoutAt = new Date(assignment.assignment_timeout_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((timeoutAt - now) / 1000));
        newCountdowns[assignment.id] = remaining;
      });
      setCountdowns(newCountdowns);

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      countdownIntervalRef.current = setInterval(() => {
        setCountdowns(prev => {
          const updated: Record<string, number> = {};
          let hasExpired = false;

          Object.entries(prev).forEach(([id, seconds]) => {
            if (seconds > 0) {
              updated[id] = seconds - 1;
            } else {
              hasExpired = true;
            }
          });

          if (hasExpired) {
            loadPendingAssignments();
          }

          return updated;
        });
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [pendingAssignments]);

  const loadRiderId = async () => {
    try {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('riders')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setRiderId(data.id);
      }
    } catch (error) {
      console.error('Error loading rider ID:', error);
    }
  };

  const loadData = async () => {
    await Promise.all([loadOrders(), loadRiderStats(), loadPendingAssignments()]);
    setRefreshing(false);
  };

  const loadPendingAssignments = async () => {
    try {
      if (!riderId) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          pickup_address,
          delivery_address,
          delivery_fee,
          assignment_timeout_at,
          created_at,
          customer:profiles!orders_customer_id_fkey(full_name, phone)
        `)
        .eq('assigned_rider_id', riderId)
        .eq('assignment_status', 'assigned')
        .eq('order_source', 'logistics')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingAssignments(data || []);
    } catch (error) {
      console.error('Error loading pending assignments:', error);
    }
  };

  const loadOrders = async () => {
    try {
      if (!riderId) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total,
          pickup_address,
          delivery_address,
          delivery_fee,
          created_at,
          customer:profiles!orders_customer_id_fkey(full_name, phone)
        `)
        .eq('rider_id', riderId)
        .eq('order_source', 'logistics')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Failed to load orders', 'error');
    }
  };

  const loadRiderStats = async () => {
    try {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('riders')
        .select('total_deliveries, status')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      setRiderStats(data);
    } catch (error) {
      console.error('Error loading rider stats:', error);
    }
  };

  const handleAcceptAssignment = async (orderId: string) => {
    try {
      setProcessingAssignment(orderId);

      const { error } = await supabase
        .from('orders')
        .update({
          assignment_status: 'accepted',
          rider_id: riderId,
          status: 'confirmed',
        })
        .eq('id', orderId)
        .eq('assigned_rider_id', riderId);

      if (error) throw error;

      await supabase
        .from('riders')
        .update({ active_orders: (riderStats?.total_deliveries || 0) + 1 })
        .eq('id', riderId);

      showToast('Order accepted! Start your delivery.', 'success');
      loadPendingAssignments();
      loadOrders();
    } catch (error) {
      console.error('Error accepting assignment:', error);
      showToast('Failed to accept order', 'error');
    } finally {
      setProcessingAssignment(null);
    }
  };

  const handleRejectAssignment = async (orderId: string) => {
    try {
      setProcessingAssignment(orderId);

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/reassign-rider`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          reason: 'Rider rejected the assignment',
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast('Order reassigned to another rider', 'info');
      } else {
        showToast(result.message || 'Order returned to pending', 'warning');
      }

      loadPendingAssignments();
    } catch (error) {
      console.error('Error rejecting assignment:', error);
      showToast('Failed to reject order', 'error');
    } finally {
      setProcessingAssignment(null);
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      showToast('Order status updated!', 'success');
      setModalVisible(false);
      loadData();
    } catch (error) {
      console.error('Error updating order:', error);
      showToast('Failed to update order', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#8b5cf6',
      ready_for_pickup: '#06b6d4',
      out_for_delivery: '#f97316',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'delivered');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Rider Dashboard</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }>

        {pendingAssignments.length > 0 && (
          <Animated.View style={[styles.pendingSection, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.pendingSectionHeader}>
              <Bell size={24} color="#ffffff" />
              <Text style={styles.pendingSectionTitle}>New Order Request{pendingAssignments.length > 1 ? 's' : ''}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingAssignments.length}</Text>
              </View>
            </View>

            {pendingAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <Text style={styles.assignmentOrderNumber}>{assignment.order_number}</Text>
                  <View style={styles.countdownContainer}>
                    <Clock size={16} color={countdowns[assignment.id] <= 30 ? '#ef4444' : '#f59e0b'} />
                    <Text style={[
                      styles.countdownText,
                      countdowns[assignment.id] <= 30 && styles.countdownUrgent
                    ]}>
                      {formatCountdown(countdowns[assignment.id] || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.assignmentDetails}>
                  {assignment.pickup_address && (
                    <View style={styles.addressRow}>
                      <View style={[styles.addressDot, { backgroundColor: '#10b981' }]} />
                      <View style={styles.addressContent}>
                        <Text style={styles.addressLabel}>Pickup</Text>
                        <Text style={styles.addressValue} numberOfLines={2}>{assignment.pickup_address}</Text>
                      </View>
                    </View>
                  )}
                  {assignment.delivery_address && (
                    <View style={styles.addressRow}>
                      <View style={[styles.addressDot, { backgroundColor: '#ef4444' }]} />
                      <View style={styles.addressContent}>
                        <Text style={styles.addressLabel}>Delivery</Text>
                        <Text style={styles.addressValue} numberOfLines={2}>{assignment.delivery_address}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.assignmentFee}>
                  <Text style={styles.feeLabel}>Delivery Fee</Text>
                  <Text style={styles.feeValue}>{'\u20A6'}{assignment.delivery_fee?.toLocaleString() || 0}</Text>
                </View>

                <View style={styles.assignmentActions}>
                  <TouchableOpacity
                    style={[styles.rejectButton, processingAssignment === assignment.id && styles.buttonDisabled]}
                    onPress={() => handleRejectAssignment(assignment.id)}
                    disabled={processingAssignment === assignment.id}>
                    <XCircle size={20} color="#ef4444" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptButton, processingAssignment === assignment.id && styles.buttonDisabled]}
                    onPress={() => handleAcceptAssignment(assignment.id)}
                    disabled={processingAssignment === assignment.id}>
                    <Check size={20} color="#ffffff" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Bike size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{riderStats?.total_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Package size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>{activeOrders.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle size={28} color="#10b981" />
            <Text style={styles.statNumber}>{completedOrders.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {orders.length === 0 && pendingAssignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No orders assigned yet</Text>
            <Text style={styles.emptySubtext}>Orders will appear here when assigned</Text>
          </View>
        ) : orders.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Assigned Orders</Text>
            {orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => {
                  setSelectedOrder(order);
                  setModalVisible(true);
                }}>
                <View style={styles.orderHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                  </View>
                  <Text style={styles.orderTotal}>{'\u20A6'}{order.total.toLocaleString()}</Text>
                </View>

                <Text style={styles.orderNumber}>{order.order_number}</Text>

                {order.customer && (
                  <View style={styles.customerInfo}>
                    <User size={16} color="#6b7280" />
                    <View style={styles.customerDetails}>
                      <Text style={styles.customerName}>{order.customer.full_name || 'Unknown Customer'}</Text>
                      <Text style={styles.customerContact}>{order.customer.phone || 'No phone'}</Text>
                    </View>
                  </View>
                )}

                {order.delivery_address && (
                  <View style={styles.addressInfo}>
                    <MapPin size={16} color="#ef4444" />
                    <Text style={styles.addressText} numberOfLines={2}>{order.delivery_address}</Text>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <View style={styles.timeInfo}>
                    <Clock size={16} color="#6b7280" />
                    <Text style={styles.timeText}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={true}>
                <View style={styles.orderSummary}>
                  <Text style={styles.orderSummaryTitle}>{selectedOrder.order_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status), alignSelf: 'flex-start', marginTop: 8 }]}>
                    <Text style={styles.statusText}>{getStatusLabel(selectedOrder.status)}</Text>
                  </View>
                </View>

                {selectedOrder.customer && (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Customer</Text>
                    <View style={styles.infoRow}>
                      <User size={18} color="#6b7280" />
                      <View style={styles.infoDetails}>
                        <Text style={styles.infoText}>{selectedOrder.customer.full_name || 'Unknown'}</Text>
                        {selectedOrder.customer.phone && (
                          <TouchableOpacity style={styles.phoneButton}>
                            <Phone size={14} color="#3b82f6" />
                            <Text style={styles.phoneText}>{selectedOrder.customer.phone}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {selectedOrder.delivery_address && (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Delivery Address</Text>
                    <View style={styles.infoRow}>
                      <MapPin size={18} color="#ef4444" />
                      <Text style={styles.infoText}>{selectedOrder.delivery_address}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Total Amount</Text>
                  <Text style={styles.totalAmount}>{'\u20A6'}{selectedOrder.total.toLocaleString()}</Text>
                </View>

                <View style={styles.actionsSection}>
                  <Text style={styles.infoLabel}>Update Status</Text>
                  {selectedOrder.status === 'pending' && (
                    <Text style={styles.statusInfo}>Waiting for admin to confirm this order</Text>
                  )}
                  {selectedOrder.status === 'confirmed' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#f97316' }]}
                      onPress={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}>
                      <Text style={styles.actionButtonText}>Start Delivery</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'out_for_delivery' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                      onPress={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                      <Text style={styles.actionButtonText}>Mark Delivered</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'delivered' && (
                    <Text style={styles.statusInfo}>This order has been delivered</Text>
                  )}
                  {selectedOrder.status === 'cancelled' && (
                    <Text style={styles.statusInfo}>This order was cancelled</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={3000}
        onDismiss={() => setToast({ ...toast, visible: false })}
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
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  pendingSection: {
    backgroundColor: '#059669',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pendingSectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  pendingBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  assignmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignmentOrderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
  countdownUrgent: {
    color: '#ef4444',
  },
  assignmentDetails: {
    gap: 8,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  assignmentFee: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginBottom: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  feeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  assignmentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#059669',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.semiBold,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerContact: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addressInfo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 24,
    paddingBottom: 40,
  },
  orderSummary: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  orderSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoDetails: {
    flex: 1,
  },
  infoText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  phoneText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  actionsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusInfo: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    textAlign: 'center',
  },
});
