import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Animated, Linking, Dimensions, TextInput, ActivityIndicator } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bike, Package, CheckCircle, Clock, AlertCircle, Phone, User, X, Bell, Check, XCircle, Power, ArrowRight, Truck, Search, History, MapPin, RefreshCw, Info, Scale, Zap, CreditCard } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';
import { Toast } from '@/components/Toast';
import { useLocation } from '@/hooks/useLocation';

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
  pickup_instructions: string | null;
  delivery_instructions: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  package_description: string | null;
  package_weight: number | null;
  order_size: string | null;
  order_types: string[] | null;
  delivery_speed: string | null;
  delivery_speed_cost: number | null;
  weight_surcharge_amount: number | null;
  weight_surcharge_label: string | null;
  payment_method: string | null;
  payment_status: string | null;
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
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { locationState, requestAndSaveLocation, loadSavedLocation } = useLocation();
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
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [historySearch, setHistorySearch] = useState('');
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
      if (profile.location_lat && profile.location_lng) {
        loadSavedLocation(profile);
      } else {
        requestAndSaveLocation(profile.id);
      }
    }
  }, [profile?.id]);

  const handleRefreshLocation = async () => {
    if (profile?.id) {
      await requestAndSaveLocation(profile.id);
    }
  };

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
          pickup_instructions,
          delivery_instructions,
          recipient_name,
          recipient_phone,
          package_description,
          package_weight,
          order_size,
          order_types,
          delivery_speed,
          delivery_speed_cost,
          weight_surcharge_amount,
          weight_surcharge_label,
          payment_method,
          payment_status,
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
        contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom + 20, 48) }]}
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

        <View style={styles.locationCard}>
          <View style={styles.locationCardLeft}>
            <View style={styles.locationIconWrap}>
              <MapPin size={18} color="#3b82f6" />
            </View>
            <View style={styles.locationCardInfo}>
              <Text style={styles.locationCardLabel}>My Location</Text>
              <Text style={styles.locationCardAddress} numberOfLines={2}>
                {locationState.loading
                  ? 'Updating location...'
                  : locationState.address || 'Location unavailable'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.locationRefreshBtn, locationState.loading && styles.locationRefreshBtnDisabled]}
            onPress={handleRefreshLocation}
            disabled={locationState.loading}
            activeOpacity={0.7}>
            {locationState.loading ? (
              <ActivityIndicator size={14} color="#3b82f6" />
            ) : (
              <RefreshCw size={14} color="#3b82f6" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'active' && styles.tabItemActive]}
            onPress={() => setActiveTab('active')}
            activeOpacity={0.8}>
            <Truck size={16} color={activeTab === 'active' ? '#ffffff' : '#6b7280'} />
            <Text style={[styles.tabItemText, activeTab === 'active' && styles.tabItemTextActive]}>
              Active
            </Text>
            {activeOrders.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'active' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'active' && styles.tabBadgeTextActive]}>
                  {activeOrders.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}>
            <History size={16} color={activeTab === 'history' ? '#ffffff' : '#6b7280'} />
            <Text style={[styles.tabItemText, activeTab === 'history' && styles.tabItemTextActive]}>
              Delivered History
            </Text>
            {completedOrders.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'history' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'history' && styles.tabBadgeTextActive]}>
                  {completedOrders.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeTab === 'active' ? (
          activeOrders.length === 0 && pendingAssignments.length === 0 ? (
            <View style={styles.emptyState}>
              <Package size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>No active orders</Text>
              <Text style={styles.emptySubtext}>New assignments will appear here</Text>
            </View>
          ) : activeOrders.length > 0 ? (
            <>
              {activeOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => { setSelectedOrder(order); setModalVisible(true); }}
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
                          {order.customer.phone && <Text style={styles.recipientPhone}>{order.customer.phone}</Text>}
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
                      {order.pickup_address && order.delivery_address && <View style={styles.routeLine} />}
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
          ) : null
        ) : (
          <>
            <View style={styles.searchContainer}>
              <Search size={18} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order number, customer, address..."
                placeholderTextColor="#9ca3af"
                value={historySearch}
                onChangeText={setHistorySearch}
                clearButtonMode="while-editing"
              />
              {historySearch.length > 0 && (
                <TouchableOpacity onPress={() => setHistorySearch('')} style={styles.searchClear}>
                  <X size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {(() => {
              const q = historySearch.toLowerCase().trim();
              const filtered = completedOrders.filter(o =>
                !q ||
                o.order_number.toLowerCase().includes(q) ||
                (o.customer?.full_name || '').toLowerCase().includes(q) ||
                (o.delivery_address || '').toLowerCase().includes(q) ||
                (o.pickup_address || '').toLowerCase().includes(q)
              );

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <History size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>
                      {q ? 'No results found' : 'No delivered orders yet'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {q ? 'Try a different search term' : 'Completed deliveries will appear here'}
                    </Text>
                  </View>
                );
              }

              return filtered.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.historyCard}
                  onPress={() => { setSelectedOrder(order); setModalVisible(true); }}
                  activeOpacity={0.92}>
                  <View style={styles.historyCardLeft}>
                    <View style={styles.historyIconWrap}>
                      <CheckCircle size={20} color="#10b981" />
                    </View>
                  </View>
                  <View style={styles.historyCardBody}>
                    <View style={styles.historyCardTop}>
                      <Text style={styles.historyOrderNumber}>{order.order_number}</Text>
                      <Text style={styles.historyFee}>{'\u20A6'}{(order.delivery_fee || order.total || 0).toLocaleString()}</Text>
                    </View>
                    {order.customer?.full_name && (
                      <View style={styles.historyCustomerRow}>
                        <User size={12} color="#6b7280" />
                        <Text style={styles.historyCustomerName}>{order.customer.full_name}</Text>
                      </View>
                    )}
                    {order.delivery_address && (
                      <View style={styles.historyAddressRow}>
                        <View style={styles.routeDotRed} />
                        <Text style={styles.historyAddress} numberOfLines={1}>{order.delivery_address}</Text>
                      </View>
                    )}
                    <View style={styles.historyFooter}>
                      <View style={styles.historyDeliveredBadge}>
                        <CheckCircle size={11} color="#059669" />
                        <Text style={styles.historyDeliveredText}>Delivered</Text>
                      </View>
                      <View style={styles.timeChip}>
                        <Clock size={11} color="#9ca3af" />
                        <Text style={styles.timeChipText}>
                          {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.historyCardChevron}>
                    <ArrowRight size={16} color="#d1d5db" />
                  </View>
                </TouchableOpacity>
              ));
            })()}
          </>
        )}
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

                {(selectedOrder.customer || selectedOrder.recipient_name) && (
                  <View style={styles.recipientCard}>
                    <View style={styles.recipientCardHeader}>
                      <User size={15} color="#6b7280" />
                      <Text style={styles.recipientCardLabel}>
                        {selectedOrder.recipient_name ? 'Recipient' : 'Customer'}
                      </Text>
                    </View>
                    <View style={styles.recipientCardBody}>
                      <View style={styles.recipientCardAvatar}>
                        <Text style={styles.recipientCardAvatarText}>
                          {(selectedOrder.recipient_name || selectedOrder.customer?.full_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.recipientCardInfo}>
                        <Text style={styles.recipientCardName}>
                          {selectedOrder.recipient_name || selectedOrder.customer?.full_name || 'Unknown'}
                        </Text>
                        {(selectedOrder.recipient_phone || selectedOrder.customer?.phone) && (
                          <TouchableOpacity
                            style={styles.callButton}
                            onPress={() => handleCall((selectedOrder.recipient_phone || selectedOrder.customer?.phone)!)}>
                            <Phone size={15} color="#ffffff" />
                            <Text style={styles.callButtonText}>
                              {selectedOrder.recipient_phone || selectedOrder.customer?.phone}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {selectedOrder.recipient_name && selectedOrder.customer?.full_name && (
                      <View style={styles.senderInfo}>
                        <Text style={styles.senderInfoLabel}>Sender:</Text>
                        <Text style={styles.senderInfoValue}>{selectedOrder.customer.full_name}</Text>
                        {selectedOrder.customer.phone && (
                          <TouchableOpacity onPress={() => handleCall(selectedOrder.customer!.phone!)}>
                            <Text style={styles.senderInfoPhone}>{selectedOrder.customer.phone}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
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
                          {selectedOrder.pickup_instructions && (
                            <Text style={styles.routeInstructions}>{selectedOrder.pickup_instructions}</Text>
                          )}
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
                          {selectedOrder.delivery_instructions && (
                            <Text style={styles.routeInstructions}>{selectedOrder.delivery_instructions}</Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {(selectedOrder.package_description || selectedOrder.order_size || selectedOrder.package_weight || (selectedOrder.order_types && selectedOrder.order_types.length > 0) || selectedOrder.delivery_speed) && (
                  <View style={styles.packageCard}>
                    <View style={styles.packageCardHeader}>
                      <Package size={15} color="#6b7280" />
                      <Text style={styles.packageCardTitle}>Package Details</Text>
                    </View>
                    <View style={styles.packageCardBody}>
                      {selectedOrder.package_description && (
                        <View style={styles.packageDetailRow}>
                          <Info size={14} color="#9ca3af" />
                          <View style={styles.packageDetailContent}>
                            <Text style={styles.packageDetailLabel}>Description</Text>
                            <Text style={styles.packageDetailValue}>{selectedOrder.package_description}</Text>
                          </View>
                        </View>
                      )}
                      {selectedOrder.order_size && (
                        <View style={styles.packageDetailRow}>
                          <Package size={14} color="#9ca3af" />
                          <View style={styles.packageDetailContent}>
                            <Text style={styles.packageDetailLabel}>Size</Text>
                            <Text style={styles.packageDetailValue}>{selectedOrder.order_size}</Text>
                          </View>
                        </View>
                      )}
                      {selectedOrder.package_weight && (
                        <View style={styles.packageDetailRow}>
                          <Scale size={14} color="#9ca3af" />
                          <View style={styles.packageDetailContent}>
                            <Text style={styles.packageDetailLabel}>Weight</Text>
                            <Text style={styles.packageDetailValue}>{selectedOrder.package_weight} kg</Text>
                          </View>
                        </View>
                      )}
                      {selectedOrder.order_types && selectedOrder.order_types.length > 0 && (
                        <View style={styles.packageDetailRow}>
                          <Info size={14} color="#9ca3af" />
                          <View style={styles.packageDetailContent}>
                            <Text style={styles.packageDetailLabel}>Type</Text>
                            <Text style={styles.packageDetailValue}>{selectedOrder.order_types.join(', ')}</Text>
                          </View>
                        </View>
                      )}
                      {selectedOrder.delivery_speed && (
                        <View style={styles.packageDetailRow}>
                          <Zap size={14} color="#9ca3af" />
                          <View style={styles.packageDetailContent}>
                            <Text style={styles.packageDetailLabel}>Speed</Text>
                            <Text style={styles.packageDetailValue}>{selectedOrder.delivery_speed}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.pricingCard}>
                  <View style={styles.packageCardHeader}>
                    <CreditCard size={15} color="#6b7280" />
                    <Text style={styles.packageCardTitle}>Pricing Breakdown</Text>
                  </View>
                  <View style={styles.pricingBody}>
                    <View style={styles.pricingRow}>
                      <Text style={styles.pricingLabel}>Delivery Fee</Text>
                      <Text style={styles.pricingValue}>{'\u20A6'}{(selectedOrder.delivery_fee || 0).toLocaleString()}</Text>
                    </View>
                    {selectedOrder.delivery_speed_cost && selectedOrder.delivery_speed_cost > 0 ? (
                      <View style={styles.pricingRow}>
                        <Text style={styles.pricingLabel}>Speed Surcharge</Text>
                        <Text style={styles.pricingValue}>{'\u20A6'}{selectedOrder.delivery_speed_cost.toLocaleString()}</Text>
                      </View>
                    ) : null}
                    {selectedOrder.weight_surcharge_amount && selectedOrder.weight_surcharge_amount > 0 ? (
                      <View style={styles.pricingRow}>
                        <Text style={styles.pricingLabel}>{selectedOrder.weight_surcharge_label || 'Weight Surcharge'}</Text>
                        <Text style={styles.pricingValue}>{'\u20A6'}{selectedOrder.weight_surcharge_amount.toLocaleString()}</Text>
                      </View>
                    ) : null}
                    <View style={styles.pricingTotalRow}>
                      <Text style={styles.pricingTotalLabel}>Total</Text>
                      <Text style={styles.pricingTotalValue}>{'\u20A6'}{(selectedOrder.total || selectedOrder.delivery_fee || 0).toLocaleString()}</Text>
                    </View>
                  </View>
                  {selectedOrder.payment_method && (
                    <View style={styles.paymentMethodRow}>
                      <Text style={styles.paymentMethodLabel}>Payment:</Text>
                      <View style={styles.paymentMethodBadge}>
                        <Text style={styles.paymentMethodText}>
                          {selectedOrder.payment_method === 'wallet' ? 'Wallet' :
                           selectedOrder.payment_method === 'transfer' ? 'Transfer' :
                           selectedOrder.payment_method === 'online' ? 'Online' :
                           selectedOrder.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' :
                           selectedOrder.payment_method}
                        </Text>
                      </View>
                      {selectedOrder.payment_status && (
                        <View style={[styles.paymentStatusBadge,
                          selectedOrder.payment_status === 'completed' ? styles.paymentStatusCompleted :
                          selectedOrder.payment_status === 'failed' ? styles.paymentStatusFailed :
                          styles.paymentStatusPending
                        ]}>
                          <Text style={[styles.paymentStatusText,
                            selectedOrder.payment_status === 'completed' ? styles.paymentStatusTextCompleted :
                            selectedOrder.payment_status === 'failed' ? styles.paymentStatusTextFailed :
                            styles.paymentStatusTextPending
                          ]}>
                            {selectedOrder.payment_status.charAt(0).toUpperCase() + selectedOrder.payment_status.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 14,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.semiBold,
  },
  feeValue: {
    fontSize: 18,
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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

  locationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCardInfo: {
    flex: 1,
  },
  locationCardLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  locationCardAddress: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#1f2937',
    lineHeight: 18,
  },
  locationRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
  },
  locationRefreshBtnDisabled: {
    opacity: 0.5,
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
    fontFamily: Fonts.bold,
  },
  orderCardRight: {
    alignItems: 'flex-end',
  },
  orderFeeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.bold,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 13,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.semiBold,
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
    height: SCREEN_HEIGHT * 0.88,
    flexDirection: 'column',
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
    fontFamily: Fonts.regular,
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
    flexGrow: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 60,
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
    fontFamily: Fonts.bold,
  },
  statusBannerFee: {
    fontSize: 18,
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  routeStopAddress: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1f2937',
    lineHeight: 20,
  },
  routeInstructions: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 17,
  },

  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexWrap: 'wrap',
  },
  senderInfoLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  senderInfoValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  senderInfoPhone: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },

  packageCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  packageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  packageCardTitle: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  packageCardBody: {
    gap: 12,
  },
  packageDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  packageDetailContent: {
    flex: 1,
  },
  packageDetailLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#9ca3af',
    marginBottom: 2,
  },
  packageDetailValue: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1f2937',
    lineHeight: 20,
  },

  pricingCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pricingBody: {
    gap: 10,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  pricingValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1f2937',
  },
  pricingTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pricingTotalLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  pricingTotalValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#059669',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexWrap: 'wrap',
  },
  paymentMethodLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  paymentMethodBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentMethodText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#374151',
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentStatusPending: {
    backgroundColor: '#fef3c7',
  },
  paymentStatusCompleted: {
    backgroundColor: '#d1fae5',
  },
  paymentStatusFailed: {
    backgroundColor: '#fee2e2',
  },
  paymentStatusText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
  paymentStatusTextPending: {
    color: '#d97706',
  },
  paymentStatusTextCompleted: {
    color: '#059669',
  },
  paymentStatusTextFailed: {
    color: '#dc2626',
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
    fontFamily: Fonts.bold,
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: '#1e3a5f',
    shadowColor: '#1e3a5f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  tabItemText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  tabItemTextActive: {
    color: '#ffffff',
  },
  tabBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  tabBadgeTextActive: {
    color: '#ffffff',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 48,
    gap: 10,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#111827',
    height: '100%',
  },
  searchClear: {
    padding: 4,
  },

  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  historyCardLeft: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCardBody: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 4,
    gap: 5,
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  historyOrderNumber: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  historyFee: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#059669',
  },
  historyCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  historyCustomerName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#374151',
  },
  historyAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyAddress: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  historyDeliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyDeliveredText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#059669',
  },
  historyCardChevron: {
    paddingHorizontal: 12,
  },
});
