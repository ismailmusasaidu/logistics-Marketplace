import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Animated, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, Package, CheckCircle, Clock, AlertCircle, MapPin, Phone, User, X, Bell, Check, XCircle, Power, ArrowRight, Navigation, CircleDot, Truck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';
import { Toast } from '@/components/Toast';

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number | null;
  delivery_address: string | null;
  pickup_address: string | null;
  delivery_fee: number | null;
  notes: string | null;
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
  const [togglingStatus, setTogglingStatus] = useState(false);
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
          notes,
          created_at,
          customer:profiles!orders_customer_id_fkey(full_name, phone)
        `)
        .eq('rider_id', riderId)
        .eq('order_source', 'logistics')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', JSON.stringify(error));
        throw error;
      }
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

  const isOnline = riderStats?.status === 'online';

  const toggleOnlineStatus = async () => {
    try {
      if (!riderId) return;
      setTogglingStatus(true);
      const newStatus = isOnline ? 'offline' : 'online';

      const { error } = await supabase
        .from('riders')
        .update({ status: newStatus })
        .eq('id', riderId);

      if (error) throw error;

      setRiderStats(prev => prev ? { ...prev, status: newStatus } : prev);
      showToast(newStatus === 'online' ? 'You are now online' : 'You are now offline', 'success');
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast('Failed to update status', 'error');
    } finally {
      setTogglingStatus(false);
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
      const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
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
      preparing: '#0ea5e9',
      ready_for_pickup: '#06b6d4',
      out_for_delivery: '#f97316',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusBg = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#fef3c7',
      confirmed: '#eff6ff',
      preparing: '#f0f9ff',
      ready_for_pickup: '#ecfeff',
      out_for_delivery: '#fff7ed',
      delivered: '#ecfdf5',
      cancelled: '#fef2f2',
    };
    return colors[status] || '#f3f4f6';
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'delivered');

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Rider Dashboard</Text>
        </View>
        <TouchableOpacity
          style={[styles.statusToggle, isOnline ? styles.statusToggleOnline : styles.statusToggleOffline]}
          onPress={toggleOnlineStatus}
          disabled={togglingStatus}
          activeOpacity={0.7}>
          <Power size={18} color={isOnline ? '#059669' : '#6b7280'} />
          <Text style={[styles.statusToggleText, isOnline ? styles.statusToggleTextOnline : styles.statusToggleTextOffline]}>
            {togglingStatus ? '...' : isOnline ? 'Online' : 'Offline'}
          </Text>
          <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
        </TouchableOpacity>
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
                }}
                activeOpacity={0.92}>

                <View style={[styles.orderCardAccent, { backgroundColor: getStatusColor(order.status) }]} />

                <View style={styles.orderCardInner}>
                  <View style={styles.orderCardTop}>
                    <View style={styles.orderCardLeft}>
                      <View style={[styles.packageIconWrap, { backgroundColor: getStatusBg(order.status) }]}>
                        <Package size={20} color={getStatusColor(order.status)} />
                      </View>
                      <View>
                        <Text style={styles.orderNumber}>{order.order_number}</Text>
                        <View style={[styles.statusPill, { backgroundColor: getStatusBg(order.status) }]}>
                          <View style={[styles.statusDotSmall, { backgroundColor: getStatusColor(order.status) }]} />
                          <Text style={[styles.statusPillText, { color: getStatusColor(order.status) }]}>
                            {getStatusLabel(order.status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.orderCardRight}>
                      <Text style={styles.orderFeeLabel}>Fee</Text>
                      <Text style={styles.orderFee}>{'\u20A6'}{(order.delivery_fee || order.total || 0).toLocaleString()}</Text>
                    </View>
                  </View>

                  {order.customer && (
                    <View style={styles.recipientRow}>
                      <View style={styles.recipientAvatar}>
                        <User size={14} color="#3b82f6" />
                      </View>
                      <View style={styles.recipientInfo}>
                        <Text style={styles.recipientName}>{order.customer.full_name || 'Unknown Customer'}</Text>
                        {order.customer.phone && (
                          <Text style={styles.recipientPhone}>{order.customer.phone}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  <View style={styles.routeContainer}>
                    {order.pickup_address && (
                      <View style={styles.routeRow}>
                        <View style={styles.routeDotGreen} />
                        <View style={styles.routeTextWrap}>
                          <Text style={styles.routeLabel}>From</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>{order.pickup_address}</Text>
                        </View>
                      </View>
                    )}
                    {order.pickup_address && order.delivery_address && (
                      <View style={styles.routeLine} />
                    )}
                    {order.delivery_address && (
                      <View style={styles.routeRow}>
                        <View style={styles.routeDotRed} />
                        <View style={styles.routeTextWrap}>
                          <Text style={styles.routeLabel}>To</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>{order.delivery_address}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.orderCardFooter}>
                    <View style={styles.timeChip}>
                      <Clock size={12} color="#9ca3af" />
                      <Text style={styles.timeChipText}>
                        {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.viewDetailChip}>
                      <Text style={styles.viewDetailText}>View Details</Text>
                      <ArrowRight size={13} color="#3b82f6" />
                    </View>
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
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalPackageIcon}>
                  <Package size={22} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Package Details</Text>
                  {selectedOrder && (
                    <Text style={styles.modalSubtitle}>{selectedOrder.order_number}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}>

                <View style={[styles.statusBanner, { backgroundColor: getStatusBg(selectedOrder.status) }]}>
                  <View style={styles.statusBannerLeft}>
                    <Truck size={20} color={getStatusColor(selectedOrder.status)} />
                    <Text style={[styles.statusBannerText, { color: getStatusColor(selectedOrder.status) }]}>
                      {getStatusLabel(selectedOrder.status)}
                    </Text>
                  </View>
                  <Text style={[styles.statusBannerFee, { color: getStatusColor(selectedOrder.status) }]}>
                    {'\u20A6'}{(selectedOrder.delivery_fee || selectedOrder.total || 0).toLocaleString()}
                  </Text>
                </View>

                {selectedOrder.customer && (
                  <View style={styles.recipientCard}>
                    <View style={styles.recipientCardHeader}>
                      <User size={15} color="#6b7280" />
                      <Text style={styles.recipientCardLabel}>Recipient</Text>
                    </View>
                    <View style={styles.recipientCardBody}>
                      <View style={styles.recipientCardAvatar}>
                        <Text style={styles.recipientCardAvatarText}>
                          {(selectedOrder.customer.full_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.recipientCardInfo}>
                        <Text style={styles.recipientCardName}>{selectedOrder.customer.full_name || 'Unknown'}</Text>
                        {selectedOrder.customer.phone && (
                          <TouchableOpacity
                            style={styles.callButton}
                            onPress={() => handleCall(selectedOrder.customer!.phone!)}>
                            <Phone size={15} color="#ffffff" />
                            <Text style={styles.callButtonText}>{selectedOrder.customer.phone}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.routeCard}>
                  <Text style={styles.routeCardTitle}>Delivery Route</Text>
                  <View style={styles.routeCardBody}>
                    {selectedOrder.pickup_address && (
                      <View style={styles.routeStop}>
                        <View style={styles.routeStopDotGreen}>
                          <View style={styles.routeStopDotInner} />
                        </View>
                        <View style={styles.routeStopBar} />
                        <View style={styles.routeStopContent}>
                          <Text style={styles.routeStopLabel}>PICKUP</Text>
                          <Text style={styles.routeStopAddress}>{selectedOrder.pickup_address}</Text>
                        </View>
                      </View>
                    )}
                    {selectedOrder.pickup_address && selectedOrder.delivery_address && (
                      <View style={styles.routeConnector}>
                        <View style={styles.routeConnectorLine} />
                      </View>
                    )}
                    {selectedOrder.delivery_address && (
                      <View style={styles.routeStop}>
                        <View style={styles.routeStopDotRed}>
                          <View style={styles.routeStopDotInner} />
                        </View>
                        <View style={styles.routeStopBarInvisible} />
                        <View style={styles.routeStopContent}>
                          <Text style={styles.routeStopLabel}>DELIVERY</Text>
                          <Text style={styles.routeStopAddress}>{selectedOrder.delivery_address}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {selectedOrder.notes && (
                  <View style={styles.notesCard}>
                    <View style={styles.notesHeader}>
                      <AlertCircle size={15} color="#f59e0b" />
                      <Text style={styles.notesLabel}>Order Notes</Text>
                    </View>
                    <Text style={styles.notesText}>{selectedOrder.notes}</Text>
                  </View>
                )}

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Clock size={14} color="#9ca3af" />
                    <Text style={styles.metaText}>
                      {new Date(selectedOrder.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsSection}>
                  {selectedOrder.status === 'pending' && (
                    <View style={styles.statusInfoBanner}>
                      <Clock size={16} color="#f59e0b" />
                      <Text style={styles.statusInfoText}>Waiting for admin to confirm this order</Text>
                    </View>
                  )}
                  {selectedOrder.status === 'confirmed' && (
                    <TouchableOpacity
                      style={styles.actionButtonDelivery}
                      onPress={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}>
                      <Truck size={20} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Start Delivery</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'out_for_delivery' && (
                    <TouchableOpacity
                      style={styles.actionButtonDelivered}
                      onPress={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                      <CheckCircle size={20} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'delivered' && (
                    <View style={styles.statusInfoBannerSuccess}>
                      <CheckCircle size={16} color="#059669" />
                      <Text style={styles.statusInfoTextSuccess}>This order has been delivered</Text>
                    </View>
                  )}
                  {selectedOrder.status === 'cancelled' && (
                    <View style={styles.statusInfoBannerError}>
                      <XCircle size={16} color="#ef4444" />
                      <Text style={styles.statusInfoTextError}>This order was cancelled</Text>
                    </View>
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
    backgroundColor: '#f1f5f9',
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
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  statusToggleOnline: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  statusToggleOffline: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  statusToggleText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  statusToggleTextOnline: {
    color: '#059669',
  },
  statusToggleTextOffline: {
    color: '#6b7280',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#059669',
  },
  statusDotOffline: {
    backgroundColor: '#9ca3af',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
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
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  orderCardAccent: {
    width: 5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  orderCardInner: {
    flex: 1,
    padding: 16,
  },
  orderCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  orderCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  packageIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumber: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderCardRight: {
    alignItems: 'flex-end',
  },
  orderFeeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 2,
  },
  orderFee: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#0ea5e9',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  recipientAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  recipientPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  routeContainer: {
    gap: 0,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fee2e2',
  },
  routeLine: {
    width: 1.5,
    height: 12,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
    marginVertical: 2,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeChipText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  viewDetailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalPackageIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBannerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBannerFee: {
    fontSize: 18,
    fontWeight: '800',
  },

  recipientCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recipientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  recipientCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recipientCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  recipientCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientCardAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  recipientCardInfo: {
    flex: 1,
    gap: 8,
  },
  recipientCardName: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  routeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  routeCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  routeCardBody: {
    gap: 0,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeStopDotGreen: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  routeStopDotRed: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  routeStopDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  routeStopBar: {
    display: 'none',
  },
  routeStopBarInvisible: {
    display: 'none',
  },
  routeConnector: {
    paddingLeft: 8,
    marginVertical: 4,
  },
  routeConnectorLine: {
    width: 2,
    height: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },
  routeStopContent: {
    flex: 1,
    paddingBottom: 4,
  },
  routeStopLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  routeStopAddress: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },

  notesCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },

  actionsSection: {
    marginTop: 4,
  },
  statusInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
  },
  statusInfoText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  statusInfoBannerSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
  },
  statusInfoTextSuccess: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '500',
  },
  statusInfoBannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  statusInfoTextError: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '500',
  },
  actionButtonDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f97316',
  },
  actionButtonDelivered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
