import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Package, MapPin, Clock, Filter, Edit2, Trash2, X, Search, User, Receipt, ShoppingBag } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/StatusBadge';
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
  user: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

export default function AdminOrders() {
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

  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleViewReceipt = (orderId: string) => {
    setSelectedOrderForReceipt(orderId);
    setReceiptModalVisible(true);
  };

  const handleCloseReceipt = () => {
    setReceiptModalVisible(false);
    setSelectedOrderForReceipt(null);
  };

  useEffect(() => {
    loadOrders();
    loadRiders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (filter !== 'all') {
      filtered = filtered.filter(o => o.status === filter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => {
        return (
          order.order_number.toLowerCase().includes(query) ||
          order.delivery_address?.toLowerCase().includes(query) ||
          order.customer?.full_name?.toLowerCase().includes(query) ||
          order.customer?.email?.toLowerCase().includes(query) ||
          order.customer?.phone?.toLowerCase().includes(query) ||
          order.vendor?.full_name?.toLowerCase().includes(query) ||
          order.vendor?.business_name?.toLowerCase().includes(query)
        );
      });
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
            id,
            vehicle_type,
            status,
            user:profiles!riders_user_id_fkey(full_name, phone)
          ),
          order_items(
            id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, name, image_url)
          )
        `)
        .eq('order_source', 'logistics')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Failed to load orders', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select(`
          id,
          user_id,
          vehicle_type,
          status,
          rating,
          total_deliveries,
          user:profiles!riders_user_id_fkey(full_name, phone)
        `)
        .order('status', { ascending: false });

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error('Error loading riders:', error);
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
        .update({
          status: editStatus,
          notes: editNotes,
          rider_id: editRiderId || null,
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      setEditModalVisible(false);
      setSelectedOrder(null);
      showToast('Order updated successfully!', 'success');
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
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
          const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

          if (error) throw error;
          showToast('Order deleted successfully', 'success');
          loadOrders();
        } catch (error) {
          console.error('Error deleting order:', error);
          showToast('Failed to delete order', 'error');
        }
      },
    });
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

  const getPaymentMethodLabel = (method: string | null) => {
    const labels: Record<string, string> = {
      wallet: 'Wallet',
      transfer: 'Transfer',
      online: 'Online',
      cash_on_delivery: 'Cash on Delivery',
    };
    return labels[method || ''] || method || 'N/A';
  };

  const getPaymentStatusColor = (status: string | null) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      completed: '#10b981',
      failed: '#ef4444',
    };
    return colors[status || ''] || '#6b7280';
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

  const statusOptions = [
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'out_for_delivery', 'delivered', 'cancelled'
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Orders</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {searchQuery || filter !== 'all' ? `${filteredOrders.length} / ${orders.length}` : orders.length}
          </Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <Filter size={18} color="#6b7280" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.filterButton, filter === item.value && styles.filterButtonActive]}
              onPress={() => setFilter(item.value)}>
              <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order number, customer, vendor..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />}>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No orders found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Orders will appear here'}
            </Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(order)}>
                    <Edit2 size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(order.id)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.orderNumber}>{order.order_number}</Text>

              {order.customer && (
                <View style={styles.customerInfo}>
                  <User size={16} color="#6b7280" />
                  <View style={styles.customerDetails}>
                    <Text style={styles.customerName}>{order.customer.full_name || 'Unknown Customer'}</Text>
                    <Text style={styles.customerContact}>
                      {order.customer.phone || order.customer.email || 'No contact'}
                    </Text>
                  </View>
                </View>
              )}

              {order.vendor && (
                <View style={styles.vendorInfo}>
                  <ShoppingBag size={16} color="#3b82f6" />
                  <View style={styles.customerDetails}>
                    <Text style={styles.vendorName}>{order.vendor.business_name || order.vendor.full_name || 'Unknown Vendor'}</Text>
                  </View>
                </View>
              )}

              {order.rider ? (
                <View style={styles.riderInfo}>
                  <User size={16} color="#10b981" />
                  <View style={styles.customerDetails}>
                    <Text style={styles.riderName}>
                      {order.rider.user?.full_name || 'Unknown Rider'} ({order.rider.vehicle_type})
                    </Text>
                    <Text style={styles.customerContact}>
                      {order.rider.user?.phone || 'No phone'} • {order.rider.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noRiderInfo}>
                  <User size={16} color="#ef4444" />
                  <Text style={styles.noRiderText}>No rider assigned</Text>
                </View>
              )}

              <View style={styles.orderDetails}>
                {order.delivery_address && (
                  <View style={styles.addressRow}>
                    <MapPin size={18} color="#ef4444" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>
                        {order.delivery_type === 'delivery' ? 'Delivery Address' : 'Pickup'}
                      </Text>
                      <Text style={styles.addressText}>{order.delivery_address}</Text>
                    </View>
                  </View>
                )}

                {order.order_items && order.order_items.length > 0 && (
                  <View style={styles.itemsSection}>
                    <Text style={styles.itemsSectionTitle}>Items ({order.order_items.length})</Text>
                    {order.order_items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.product?.name || 'Deleted Product'}
                        </Text>
                        <Text style={styles.itemPrice}>
                          {'\u20A6'}{item.subtotal.toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {order.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Notes:</Text>
                    <Text style={styles.notesText}>{order.notes}</Text>
                  </View>
                )}

                <View style={styles.timelineContainer}>
                  <Text style={styles.timelineTitle}>Order Timeline</Text>
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#10b981' }]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineLabel}>Created</Text>
                      <Text style={styles.timelineTime}>{formatRelativeTime(order.created_at)}</Text>
                    </View>
                  </View>
                  {order.confirmed_at && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#3b82f6' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Confirmed</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.confirmed_at)}</Text>
                      </View>
                    </View>
                  )}
                  {order.preparing_at && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#8b5cf6' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Preparing</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.preparing_at)}</Text>
                      </View>
                    </View>
                  )}
                  {order.ready_for_pickup_at && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#06b6d4' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Ready for Pickup</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.ready_for_pickup_at)}</Text>
                      </View>
                    </View>
                  )}
                  {order.out_for_delivery_at && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#f97316' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Out for Delivery</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.out_for_delivery_at)}</Text>
                      </View>
                    </View>
                  )}
                  {order.delivered_at && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Delivered</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.delivered_at)}</Text>
                      </View>
                    </View>
                  )}
                  {order.cancelled_at && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#ef4444' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Cancelled</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.cancelled_at)}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <View style={styles.footerLeft}>
                    <View style={styles.timeInfo}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeText}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.paymentMethodBadge}>
                      <Text style={styles.paymentMethodText}>
                        {getPaymentMethodLabel(order.payment_method)}
                      </Text>
                    </View>
                    <View style={[styles.paymentStatusBadge, { backgroundColor: getPaymentStatusColor(order.payment_status) + '20' }]}>
                      <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(order.payment_status) }]}>
                        {order.payment_status?.toUpperCase() || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.feeText}>{'\u20A6'}{order.total.toLocaleString()}</Text>
                </View>

                <TouchableOpacity
                  style={styles.receiptButton}
                  onPress={() => handleViewReceipt(order.id)}>
                  <Receipt size={16} color="#f97316" />
                  <Text style={styles.receiptButtonText}>View Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Order</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedOrder && (
                <View style={styles.orderSummary}>
                  <Text style={styles.orderSummaryTitle}>{selectedOrder.order_number}</Text>
                  <Text style={styles.orderSummarySubtitle}>
                    {selectedOrder.customer?.full_name || 'Unknown Customer'}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Status</Text>
              <View style={styles.statusSelector}>
                {statusOptions.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      editStatus === status && styles.statusOptionActive
                    ]}
                    onPress={() => setEditStatus(status)}>
                    <Text style={[
                      styles.statusOptionText,
                      editStatus === status && styles.statusOptionTextActive
                    ]}>
                      {getStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Assign Rider</Text>
              <View style={styles.riderSelector}>
                <TouchableOpacity
                  style={[
                    styles.riderOption,
                    editRiderId === '' && styles.riderOptionActive
                  ]}
                  onPress={() => setEditRiderId('')}>
                  <Text style={[
                    styles.riderOptionText,
                    editRiderId === '' && styles.riderOptionTextActive
                  ]}>
                    No Rider
                  </Text>
                </TouchableOpacity>
                {riders.map((rider) => (
                  <TouchableOpacity
                    key={rider.id}
                    style={[
                      styles.riderOption,
                      editRiderId === rider.id && styles.riderOptionActive
                    ]}
                    onPress={() => setEditRiderId(rider.id)}>
                    <View style={styles.riderOptionContent}>
                      <Text style={[
                        styles.riderOptionText,
                        editRiderId === rider.id && styles.riderOptionTextActive
                      ]}>
                        {rider.user?.full_name || 'Unknown'}
                      </Text>
                      <Text style={[
                        styles.riderOptionDetails,
                        editRiderId === rider.id && styles.riderOptionDetailsActive
                      ]}>
                        {rider.vehicle_type} • {rider.status === 'online' ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Enter notes"
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
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

      <OrderReceiptModal
        visible={receiptModalVisible}
        onClose={handleCloseReceipt}
        orderId={selectedOrderForReceipt || ''}
      />
    </View>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
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
    backgroundColor: '#0ea5e9',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  clearButton: {
    padding: 4,
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
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
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
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 12,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  orderDetails: {
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
  },
  itemsSection: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  itemsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    width: 30,
  },
  itemName: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  notesSection: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  timelineContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6b7280',
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
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
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
  feeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  paymentMethodBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentMethodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 12,
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    color: '#f97316',
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
    maxHeight: '90%',
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
    padding: 24,
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
  orderSummarySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  statusOptionActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusOptionTextActive: {
    color: '#ffffff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    marginBottom: 12,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  noRiderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    marginBottom: 12,
  },
  noRiderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
  },
  riderSelector: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  riderOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  riderOptionActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  riderOptionContent: {
    flexDirection: 'column',
  },
  riderOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  riderOptionTextActive: {
    color: '#ffffff',
  },
  riderOptionDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  riderOptionDetailsActive: {
    color: '#e0f2fe',
  },
});
