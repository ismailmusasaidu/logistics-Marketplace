import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Package, MapPin, Clock, Filter, Edit2, Trash2, X, Search, User, Receipt, ShoppingBag, Bike, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OrderReceiptModal } from '@/components/OrderReceiptModal';
import { Fonts } from '@/constants/fonts';

const formatRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return 'Not yet';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

type MarketplaceOrder = {
  id: string;
  customer_id: string | null;
  vendor_id: string | null;
  vendor_user_id: string | null;
  order_number: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  delivery_address: string | null;
  delivery_type: string;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  rider_id: string | null;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_for_pickup_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  vendor?: { id: string; full_name: string | null; email: string | null; business_name: string | null } | null;
  rider?: { id: string; user: { full_name: string | null; phone: string | null } | null; vehicle_type: string; status: string } | null;
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product?: { id: string; name: string; image_url: string | null } | null;
  }>;
};

type Rider = {
  id: string;
  user_id: string;
  vehicle_type: string;
  status: string;
  rating: number;
  total_deliveries: number;
  user: { full_name: string | null; phone: string | null } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Pending',          color: '#d97706', bg: '#fef3c7' },
  confirmed:        { label: 'Confirmed',         color: '#2563eb', bg: '#dbeafe' },
  preparing:        { label: 'Preparing',         color: '#7c3aed', bg: '#ede9fe' },
  ready_for_pickup: { label: 'Ready for Pickup',  color: '#0891b2', bg: '#cffafe' },
  out_for_delivery: { label: 'Out for Delivery',  color: '#ea580c', bg: '#ffedd5' },
  delivered:        { label: 'Delivered',         color: '#059669', bg: '#d1fae5' },
  cancelled:        { label: 'Cancelled',         color: '#dc2626', bg: '#fee2e2' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  wallet: 'Wallet',
  transfer: 'Transfer',
  online: 'Online',
  cash_on_delivery: 'Cash on Delivery',
};

const PAYMENT_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending:   { color: '#d97706', bg: '#fef3c7' },
  completed: { color: '#059669', bg: '#d1fae5' },
  failed:    { color: '#dc2626', bg: '#fee2e2' },
};

const TIMELINE_STEPS = [
  { key: 'created_at',           label: 'Created',          color: '#10b981' },
  { key: 'confirmed_at',         label: 'Confirmed',        color: '#3b82f6' },
  { key: 'preparing_at',         label: 'Preparing',        color: '#8b5cf6' },
  { key: 'ready_for_pickup_at',  label: 'Ready for Pickup', color: '#06b6d4' },
  { key: 'out_for_delivery_at',  label: 'Out for Delivery', color: '#f97316' },
  { key: 'delivered_at',         label: 'Delivered',        color: '#22c55e' },
  { key: 'cancelled_at',         label: 'Cancelled',        color: '#ef4444' },
];

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<MarketplaceOrder[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MarketplaceOrder | null>(null);
  const [editStatus, setEditStatus] = useState<string>('pending');
  const [editNotes, setEditNotes] = useState('');
  const [editRiderId, setEditRiderId] = useState<string>('');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ visible: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleViewReceipt = (orderId: string) => {
    setSelectedOrderForReceipt(orderId);
    setReceiptModalVisible(true);
  };

  useEffect(() => {
    loadOrders();
    loadRiders();
  }, []);

  useEffect(() => {
    let filtered = orders;
    if (filter !== 'all') filtered = filtered.filter(o => o.status === filter);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(query) ||
        order.delivery_address?.toLowerCase().includes(query) ||
        order.customer?.full_name?.toLowerCase().includes(query) ||
        order.customer?.email?.toLowerCase().includes(query) ||
        order.customer?.phone?.toLowerCase().includes(query) ||
        order.vendor?.full_name?.toLowerCase().includes(query) ||
        order.vendor?.business_name?.toLowerCase().includes(query)
      );
    }
    setFilteredOrders(filtered);
  }, [filter, orders, searchQuery]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(id, full_name, email, phone),
          vendor:profiles!orders_vendor_id_fkey(id, full_name, email, business_name),
          rider:riders!orders_rider_id_fkey(
            id, vehicle_type, status,
            user:profiles!riders_user_id_fkey(full_name, phone)
          ),
          order_items(
            id, quantity, unit_price, subtotal,
            product:products(id, name, image_url)
          )
        `)
        .eq('order_source', 'logistics')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      showToast('Failed to load orders', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select('id, user_id, vehicle_type, status, rating, total_deliveries, user:profiles!riders_user_id_fkey(full_name, phone)')
        .order('status', { ascending: false });
      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      showToast('Failed to load riders', 'error');
    }
  };

  const handleEdit = (order: MarketplaceOrder) => {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditNotes(order.notes || '');
    setEditRiderId(order.rider_id || '');
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedOrder) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: editStatus, notes: editNotes, rider_id: editRiderId || null })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setEditModalVisible(false);
      setSelectedOrder(null);
      showToast('Order updated successfully!', 'success');
      loadOrders();
    } catch (error) {
      showToast('Failed to update order', 'error');
    }
  };

  const handleDelete = (orderId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Order',
      message: 'Are you sure you want to delete this order? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('orders').delete().eq('id', orderId);
          if (error) throw error;
          showToast('Order deleted successfully', 'success');
          loadOrders();
        } catch (error) {
          showToast('Failed to delete order', 'error');
        }
      },
    });
  };

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'Ready', value: 'ready_for_pickup' },
    { label: 'Out for Delivery', value: 'out_for_delivery' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  const statusOptions = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled'];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>All Orders</Text>
          <Text style={styles.subtitle}>Manage and track logistics orders</Text>
        </View>
        <View style={styles.headerBadge}>
          <Package size={14} color="#f97316" />
          <Text style={styles.headerBadgeText}>
            {searchQuery || filter !== 'all' ? `${filteredOrders.length} / ${orders.length}` : orders.length}
          </Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <Filter size={15} color="#9ca3af" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
              onPress={() => setFilter(item.value)}
              activeOpacity={0.7}>
              <Text style={[styles.filterChipText, filter === item.value && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchBar}>
        <Search size={17} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order, customer, vendor..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={17} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} tintColor="#f97316" />}>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Package size={36} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try adjusting your search' : 'Orders will appear here'}
            </Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const sc = STATUS_CONFIG[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6' };
            const paymentSc = PAYMENT_STATUS_CONFIG[order.payment_status || ''] || { color: '#6b7280', bg: '#f3f4f6' };
            const timelineSteps = TIMELINE_STEPS.filter(s => s.key === 'created_at' || (order as any)[s.key]);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardTopBar}>
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                    <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(order)} activeOpacity={0.7}>
                      <Edit2 size={15} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDelete(order.id)} activeOpacity={0.7}>
                      <Trash2 size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.orderNumber}>#{order.order_number}</Text>

                <View style={styles.infoGrid}>
                  {order.customer && (
                    <View style={[styles.infoRow, styles.infoRowCustomer]}>
                      <View style={[styles.infoIcon, { backgroundColor: '#eff6ff' }]}>
                        <User size={14} color="#3b82f6" />
                      </View>
                      <View style={styles.infoBody}>
                        <Text style={styles.infoLabel}>Customer</Text>
                        <Text style={styles.infoValue}>{order.customer.full_name || 'Unknown Customer'}</Text>
                        {(order.customer.phone || order.customer.email) && (
                          <Text style={styles.infoMeta}>{order.customer.phone || order.customer.email}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {order.vendor && (
                    <View style={[styles.infoRow, styles.infoRowVendor]}>
                      <View style={[styles.infoIcon, { backgroundColor: '#faf5ff' }]}>
                        <ShoppingBag size={14} color="#7c3aed" />
                      </View>
                      <View style={styles.infoBody}>
                        <Text style={styles.infoLabel}>Vendor</Text>
                        <Text style={[styles.infoValue, { color: '#6d28d9' }]}>
                          {order.vendor.business_name || order.vendor.full_name || 'Unknown Vendor'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {order.rider ? (
                    <View style={[styles.infoRow, styles.infoRowRider]}>
                      <View style={[styles.infoIcon, { backgroundColor: '#f0fdf4' }]}>
                        <Bike size={14} color="#16a34a" />
                      </View>
                      <View style={styles.infoBody}>
                        <Text style={styles.infoLabel}>Rider</Text>
                        <Text style={[styles.infoValue, { color: '#15803d' }]}>
                          {order.rider.user?.full_name || 'Unknown'} · {order.rider.vehicle_type}
                        </Text>
                        <Text style={styles.infoMeta}>
                          {order.rider.user?.phone || 'No phone'} · {order.rider.status === 'available' ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.infoRow, styles.infoRowNoRider]}>
                      <View style={[styles.infoIcon, { backgroundColor: '#fff1f2' }]}>
                        <AlertCircle size={14} color="#e11d48" />
                      </View>
                      <View style={styles.infoBody}>
                        <Text style={[styles.infoValue, { color: '#be123c' }]}>No rider assigned</Text>
                      </View>
                    </View>
                  )}

                  {order.delivery_address && (
                    <View style={styles.addressRow}>
                      <MapPin size={14} color="#ef4444" />
                      <View style={styles.addressBody}>
                        <Text style={styles.addressLabel}>
                          {order.delivery_type === 'delivery' ? 'Delivery Address' : 'Pickup Location'}
                        </Text>
                        <Text style={styles.addressText}>{order.delivery_address}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {order.order_items && order.order_items.length > 0 && (
                  <View style={styles.cartSection}>
                    <View style={styles.cartHeader}>
                      <ShoppingBag size={14} color="#6b7280" />
                      <Text style={styles.cartTitle}>Order Items</Text>
                      <View style={styles.cartCount}>
                        <Text style={styles.cartCountText}>{order.order_items.length}</Text>
                      </View>
                    </View>
                    {order.order_items.map((item) => (
                      <View key={item.id} style={styles.cartItem}>
                        <View style={styles.cartItemQtyBadge}>
                          <Text style={styles.cartItemQty}>{item.quantity}x</Text>
                        </View>
                        <Text style={styles.cartItemName} numberOfLines={1}>
                          {item.product?.name || 'Deleted Product'}
                        </Text>
                        <Text style={styles.cartItemPrice}>₦{item.subtotal.toLocaleString()}</Text>
                      </View>
                    ))}
                    <View style={styles.cartTotals}>
                      <View style={styles.cartTotalRow}>
                        <Text style={styles.cartTotalLabel}>Subtotal</Text>
                        <Text style={styles.cartTotalValue}>₦{order.subtotal.toLocaleString()}</Text>
                      </View>
                      {order.delivery_fee > 0 && (
                        <View style={styles.cartTotalRow}>
                          <Text style={styles.cartTotalLabel}>Delivery Fee</Text>
                          <Text style={styles.cartTotalValue}>₦{order.delivery_fee.toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={[styles.cartTotalRow, styles.cartGrandTotal]}>
                        <Text style={styles.cartGrandLabel}>Total</Text>
                        <Text style={styles.cartGrandValue}>₦{order.total.toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {order.notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Text style={styles.notesText}>{order.notes}</Text>
                  </View>
                )}

                <View style={styles.timelineSection}>
                  <Text style={styles.timelineTitle}>Timeline</Text>
                  <View style={styles.timelineList}>
                    {timelineSteps.map((step, idx) => {
                      const ts = (order as any)[step.key];
                      if (!ts) return null;
                      return (
                        <View key={step.key} style={styles.timelineRow}>
                          <View style={styles.timelineTrack}>
                            <View style={[styles.timelineDot, { backgroundColor: step.color }]} />
                            {idx < timelineSteps.length - 1 && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineInfo}>
                            <Text style={styles.timelineLabel}>{step.label}</Text>
                            <Text style={styles.timelineTime}>{formatRelativeTime(ts)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.footerMeta}>
                    <View style={styles.footerMetaRow}>
                      <Clock size={13} color="#9ca3af" />
                      <Text style={styles.footerDate}>{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    </View>
                    <View style={styles.footerBadges}>
                      <View style={styles.paymentMethodBadge}>
                        <Text style={styles.paymentMethodText}>
                          {PAYMENT_METHOD_LABELS[order.payment_method || ''] || order.payment_method || 'N/A'}
                        </Text>
                      </View>
                      <View style={[styles.paymentStatusBadge, { backgroundColor: paymentSc.bg }]}>
                        <Text style={[styles.paymentStatusText, { color: paymentSc.color }]}>
                          {(order.payment_status || 'N/A').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.receiptBtn}
                  onPress={() => handleViewReceipt(order.id)}
                  activeOpacity={0.8}>
                  <Receipt size={15} color="#f97316" />
                  <Text style={styles.receiptBtnText}>View Receipt</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Order</Text>
                {selectedOrder && (
                  <Text style={styles.modalSubtitle}>#{selectedOrder.order_number}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setEditModalVisible(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedOrder && (
                <View style={styles.editSummaryCard}>
                  <View style={styles.editSummaryLeft}>
                    <View style={styles.editSummaryIcon}>
                      <Package size={18} color="#f97316" />
                    </View>
                    <View>
                      <Text style={styles.editSummaryTitle}>{selectedOrder.customer?.full_name || 'Unknown Customer'}</Text>
                      <Text style={styles.editSummaryMeta}>{selectedOrder.customer?.phone || selectedOrder.customer?.email || 'No contact'}</Text>
                    </View>
                  </View>
                  <Text style={styles.editSummaryTotal}>₦{selectedOrder.total.toLocaleString()}</Text>
                </View>
              )}

              <Text style={styles.modalSectionLabel}>Order Status</Text>
              <View style={styles.statusGrid}>
                {statusOptions.map((status) => {
                  const sc = STATUS_CONFIG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
                  const isActive = editStatus === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.statusGridItem, isActive && { backgroundColor: sc.color, borderColor: sc.color }]}
                      onPress={() => setEditStatus(status)}
                      activeOpacity={0.75}>
                      {isActive && <CheckCircle size={12} color="#fff" />}
                      <Text style={[styles.statusGridText, isActive && styles.statusGridTextActive]}>
                        {sc.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalSectionLabel}>Assign Rider</Text>
              <ScrollView style={styles.riderList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.riderItem, editRiderId === '' && styles.riderItemActive]}
                  onPress={() => setEditRiderId('')}
                  activeOpacity={0.8}>
                  <View style={[styles.riderItemIcon, editRiderId === '' && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <X size={14} color={editRiderId === '' ? '#fff' : '#9ca3af'} />
                  </View>
                  <View style={styles.riderItemBody}>
                    <Text style={[styles.riderItemName, editRiderId === '' && styles.riderItemTextActive]}>No Rider</Text>
                    <Text style={[styles.riderItemMeta, editRiderId === '' && styles.riderItemMetaActive]}>Unassign rider from this order</Text>
                  </View>
                  {editRiderId === '' && <CheckCircle size={16} color="#fff" />}
                </TouchableOpacity>
                {riders.map((rider) => {
                  const isActive = editRiderId === rider.id;
                  const isOnline = rider.status === 'available';
                  return (
                    <TouchableOpacity
                      key={rider.id}
                      style={[styles.riderItem, isActive && styles.riderItemActive]}
                      onPress={() => setEditRiderId(rider.id)}
                      activeOpacity={0.8}>
                      <View style={[styles.riderItemIcon, isActive && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Bike size={14} color={isActive ? '#fff' : '#6b7280'} />
                      </View>
                      <View style={styles.riderItemBody}>
                        <Text style={[styles.riderItemName, isActive && styles.riderItemTextActive]}>
                          {rider.user?.full_name || 'Unknown Rider'}
                        </Text>
                        <View style={styles.riderItemMetaRow}>
                          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#22c55e' : '#d1d5db' }]} />
                          <Text style={[styles.riderItemMeta, isActive && styles.riderItemMetaActive]}>
                            {rider.vehicle_type} · {isOnline ? 'Online' : 'Offline'} · {rider.total_deliveries} deliveries
                          </Text>
                        </View>
                      </View>
                      {isActive && <CheckCircle size={16} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.modalSectionLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add notes about this order..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} activeOpacity={0.8}>
                <CheckCircle size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} duration={5000} onDismiss={() => setToast({ ...toast, visible: false })} />
      <ConfirmDialog visible={confirmDialog.visible} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })} />
      <OrderReceiptModal visible={receiptModalVisible} onClose={() => { setReceiptModalVisible(false); setSelectedOrderForReceipt(null); }} orderId={selectedOrderForReceipt || ''} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 18,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  headerBadgeText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#f97316',
  },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  filterScroll: { gap: 8, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#111827',
    padding: 0,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: '#374151' },
  emptySubtitle: { fontSize: 14, fontFamily: Fonts.regular, color: '#9ca3af' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  cardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.2 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: { backgroundColor: '#fff1f2' },

  orderNumber: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#9ca3af',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  infoGrid: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  infoRowCustomer: { backgroundColor: '#f0f9ff' },
  infoRowVendor: { backgroundColor: '#faf5ff' },
  infoRowRider: { backgroundColor: '#f0fdf4' },
  infoRowNoRider: { backgroundColor: '#fff1f2' },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBody: { flex: 1 },
  infoLabel: { fontSize: 10, fontFamily: Fonts.semiBold, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  infoValue: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#111827' },
  infoMeta: { fontSize: 12, fontFamily: Fonts.regular, color: '#6b7280', marginTop: 1 },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
  },
  addressBody: { flex: 1 },
  addressLabel: { fontSize: 10, fontFamily: Fonts.semiBold, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  addressText: { fontSize: 13, fontFamily: Fonts.regular, color: '#374151', lineHeight: 18 },

  cartSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cartTitle: { flex: 1, fontSize: 13, fontFamily: Fonts.bold, color: '#374151' },
  cartCount: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cartCountText: { fontSize: 11, fontFamily: Fonts.bold, color: '#6b7280' },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cartItemQtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemQty: { fontSize: 12, fontFamily: Fonts.bold, color: '#0369a1' },
  cartItemName: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, color: '#111827' },
  cartItemPrice: { fontSize: 13, fontFamily: Fonts.bold, color: '#374151' },
  cartTotals: { paddingHorizontal: 14, paddingVertical: 10, gap: 5 },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cartTotalLabel: { fontSize: 13, fontFamily: Fonts.regular, color: '#6b7280' },
  cartTotalValue: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#374151' },
  cartGrandTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cartGrandLabel: { fontSize: 14, fontFamily: Fonts.bold, color: '#111827' },
  cartGrandValue: { fontSize: 16, fontFamily: Fonts.bold, color: '#f97316' },

  notesBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  notesLabel: { fontSize: 11, fontFamily: Fonts.bold, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 13, fontFamily: Fonts.regular, color: '#78350f', lineHeight: 18 },

  timelineSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  timelineTitle: { fontSize: 12, fontFamily: Fonts.bold, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  timelineList: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 32 },
  timelineTrack: { alignItems: 'center', width: 20, marginRight: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2 },
  timelineInfo: { flex: 1, paddingBottom: 10 },
  timelineLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#374151' },
  timelineTime: { fontSize: 11, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 1 },

  cardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
  },
  footerMeta: { gap: 8 },
  footerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerDate: { fontSize: 12, fontFamily: Fonts.regular, color: '#9ca3af' },
  footerBadges: { flexDirection: 'row', gap: 8 },
  paymentMethodBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentMethodText: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#1d4ed8' },
  paymentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentStatusText: { fontSize: 11, fontFamily: Fonts.bold },

  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  receiptBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#f97316' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 20, fontFamily: Fonts.bold, color: '#111827' },
  modalSubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 2 },
  modalClose: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 24, paddingTop: 20 },

  editSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  editSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editSummaryIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#ffedd5', alignItems: 'center', justifyContent: 'center',
  },
  editSummaryTitle: { fontSize: 15, fontFamily: Fonts.bold, color: '#111827' },
  editSummaryMeta: { fontSize: 12, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 2 },
  editSummaryTotal: { fontSize: 18, fontFamily: Fonts.bold, color: '#f97316' },

  modalSectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statusGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  statusGridText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#6b7280' },
  statusGridTextActive: { color: '#ffffff' },

  riderList: { maxHeight: 240, marginBottom: 24, borderRadius: 14, overflow: 'hidden' },
  riderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  riderItemActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  riderItemIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  riderItemBody: { flex: 1 },
  riderItemName: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#111827' },
  riderItemTextActive: { color: '#ffffff' },
  riderItemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  riderItemMeta: { fontSize: 12, fontFamily: Fonts.regular, color: '#6b7280' },
  riderItemMetaActive: { color: 'rgba(255,255,255,0.75)' },

  notesInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#111827',
    height: 90,
    backgroundColor: '#f9fafb',
  },

  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#374151' },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f97316',
  },
  saveBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#ffffff' },
});
