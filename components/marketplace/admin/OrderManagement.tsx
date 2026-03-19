import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Package, Clock, CircleCheck as CheckCircle, Truck, Circle as XCircle, CreditCard as Edit3, X, ArrowLeft, ShoppingBag, Search, Trash2, Receipt, User, Store, MapPin, CreditCard, ListFilter as Filter } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Order, OrderStatus, OrderItem, Product } from '@/types/database';
import { useToast } from '@/contexts/ToastContext';
import OrderReceipt from '@/components/marketplace/OrderReceipt';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendMarketplaceOrderStatusEmail, sendMarketplacePaymentReceivedEmail } from '@/lib/emailService';

const statusIcons: Record<OrderStatus, any> = {
  pending: Clock,
  confirmed: CheckCircle,
  preparing: Package,
  ready_for_pickup: ShoppingBag,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusColors: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#ff8c00',
  preparing: '#ff8c00',
  ready_for_pickup: '#ff8c00',
  out_for_delivery: '#3b82f6',
  delivered: '#059669',
  cancelled: '#ef4444',
};

const statusBgColors: Record<OrderStatus, string> = {
  pending: '#fffbeb',
  confirmed: '#fff7ed',
  preparing: '#fff7ed',
  ready_for_pickup: '#fff7ed',
  out_for_delivery: '#eff6ff',
  delivered: '#ecfdf5',
  cancelled: '#fef2f2',
};

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

interface OrderWithCustomer extends Order {
  customer: {
    full_name: string;
    email: string;
    phone?: string;
  };
  vendor: {
    business_name: string;
  };
}

interface OrderItemWithProduct extends OrderItem {
  products: Product;
}

interface StatusCounts {
  all: number;
  pending: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
}

interface OrderManagementProps {
  onBack?: () => void;
}

const PAGE_SIZE = 20;

export default function OrderManagement({ onBack }: OrderManagementProps) {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ all: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 });
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderWithCustomer | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [orderItemsCache, setOrderItemsCache] = useState<Record<string, OrderItemWithProduct[]>>({});

  const searchRef = useRef(searchQuery);
  const filterRef = useRef(activeFilter);
  searchRef.current = searchQuery;
  filterRef.current = activeFilter;

  const buildQuery = useCallback((search: string, filter: string, from: number, to: number) => {
    let q = supabase
      .from('orders')
      .select(`*, customer:profiles!orders_customer_id_fkey(full_name, email, phone)`, { count: 'exact' })
      .eq('order_source', 'marketplace')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filter === 'confirmed') {
      q = q.in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery']);
    } else if (filter !== 'all') {
      q = q.eq('status', filter);
    }

    if (search.trim()) {
      q = q.or(`order_number.ilike.%${search.trim()}%,id.ilike.%${search.trim()}%`);
    }

    return q;
  }, []);

  const attachVendors = useCallback(async (data: any[]): Promise<OrderWithCustomer[]> => {
    const vendorUserIds = [...new Set(data.map((o: any) => o.vendor_user_id).filter(Boolean))];
    let vendorMap: Record<string, string> = {};
    if (vendorUserIds.length > 0) {
      const { data: vendors } = await supabase
        .from('vendors')
        .select('user_id, business_name')
        .in('user_id', vendorUserIds);
      (vendors || []).forEach((v: any) => { vendorMap[v.user_id] = v.business_name; });
    }
    return data.map((order: any) => ({
      ...order,
      customer: order.customer || { full_name: 'Unknown', email: 'N/A', phone: null },
      vendor: { business_name: vendorMap[order.vendor_user_id] || 'Unknown' },
    }));
  }, []);

  const fetchStatusCounts = useCallback(async () => {
    const [allRes, pendingRes, confirmedRes, deliveredRes, cancelledRes] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_source', 'marketplace'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_source', 'marketplace').eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_source', 'marketplace').in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery']),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_source', 'marketplace').eq('status', 'delivered'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_source', 'marketplace').eq('status', 'cancelled'),
    ]);
    setStatusCounts({
      all: allRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      confirmed: confirmedRes.count ?? 0,
      delivered: deliveredRes.count ?? 0,
      cancelled: cancelledRes.count ?? 0,
    });
  }, []);

  const fetchOrders = useCallback(async (search: string, filter: string) => {
    setLoading(true);
    setPage(0);
    try {
      const { data, error, count } = await buildQuery(search, filter, 0, PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const formatted = await attachVendors(data || []);
      setOrders(formatted);
      setTotalCount(count ?? 0);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, attachVendors]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { data, error } = await buildQuery(searchRef.current, filterRef.current, from, to);
      if (error) throw error;
      const formatted = await attachVendors(data || []);
      setOrders((prev) => [...prev, ...formatted]);
      setPage(nextPage);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more orders:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, buildQuery, attachVendors]);

  useEffect(() => {
    fetchOrders(searchQuery, activeFilter);
    fetchStatusCounts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders(searchQuery, activeFilter);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: 'order_source=eq.marketplace' }, async (payload) => {
        const formatted = await attachVendors([payload.new]);
        setOrders((prev) => [formatted[0], ...prev]);
        setTotalCount((c) => c + 1);
        fetchStatusCounts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'order_source=eq.marketplace' }, async (payload) => {
        const formatted = await attachVendors([payload.new]);
        setOrders((prev) => prev.map((o) => (o.id === formatted[0].id ? { ...o, ...formatted[0] } : o)));
        if (selectedOrder?.id === formatted[0].id) {
          setSelectedOrder((prev) => prev ? { ...prev, ...formatted[0] } : prev);
        }
        fetchStatusCounts();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        const deleted = payload.old as Order;
        setOrders((prev) => prev.filter((o) => o.id !== deleted.id));
        setTotalCount((c) => Math.max(0, c - 1));
        fetchStatusCounts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [attachVendors, fetchStatusCounts, selectedOrder?.id]);

  const deleteOrder = async (orderId: string) => {
    try {
      setDeletingOrder(true);

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw new Error(error.message);

      setShowStatusModal(false);
      setSelectedOrder(null);
      showToast('Order deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting order:', error);
      showToast('Failed to delete order', 'error');
    } finally {
      setDeletingOrder(false);
      setShowDeleteConfirmation(false);
      setOrderToDelete(null);
    }
  };

  const confirmDelete = (order: OrderWithCustomer) => {
    setOrderToDelete(order);
    setShowDeleteConfirmation(true);
  };

  const fetchSelectedOrderItems = useCallback(async (orderId: string) => {
    if (orderItemsCache[orderId]) {
      setSelectedOrderItems(orderItemsCache[orderId]);
      return;
    }
    try {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', orderId);
      if (!error) {
        const items = (data as OrderItemWithProduct[]) || [];
        setSelectedOrderItems(items);
        setOrderItemsCache((prev) => ({ ...prev, [orderId]: items }));
      }
    } catch {
      setSelectedOrderItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [orderItemsCache]);

  const handleViewReceipt = async (order: Order) => {
    const cached = orderItemsCache[order.id];
    if (cached) {
      setOrderItems(cached);
      setReceiptOrder(order);
      setShowReceipt(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', order.id);

      if (error) throw error;

      const items = data as OrderItemWithProduct[] || [];
      setOrderItemsCache((prev) => ({ ...prev, [order.id]: items }));
      setOrderItems(items);
      setReceiptOrder(order);
      setShowReceipt(true);
    } catch (error) {
      console.error('Error fetching order items:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(true);

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw new Error(error.message);

      if (selectedOrder && ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'].includes(newStatus)) {
        sendMarketplaceOrderStatusEmail(
          newStatus as 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled',
          {
            orderNumber: selectedOrder.order_number,
            customerEmail: selectedOrder.customer.email,
            customerName: selectedOrder.customer.full_name,
            totalAmount: selectedOrder.total,
            deliveryAddress: selectedOrder.delivery_address || undefined,
          }
        );
      }

      setShowStatusModal(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const markAsPaid = async (order: OrderWithCustomer) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw new Error(error.message);

      sendMarketplacePaymentReceivedEmail({
        orderNumber: order.order_number,
        customerEmail: order.customer.email,
        customerName: order.customer.full_name,
        totalAmount: order.total,
      });

      showToast('Payment marked as paid', 'success');
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      showToast('Failed to update payment status', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: OrderStatus) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash_on_delivery': return 'Cash on Delivery';
      case 'wallet': return 'Wallet';
      case 'online': return 'Online Payment';
      default: return 'Bank Transfer';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Orders</Text>
            <Text style={styles.subtitle}>
              {orders.length} of {totalCount.toLocaleString()} orders
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color="#8b909a" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders or customers..."
            placeholderTextColor="#8b909a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#8b909a" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((tab) => {
            const count = statusCounts[tab.key as keyof StatusCounts] ?? 0;
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#ff8c00" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'No orders match this filter'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const StatusIcon = statusIcons[item.status];
          const statusColor = statusColors[item.status];
          const statusBg = statusBgColors[item.status];

          return (
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() => {
                setSelectedOrder(item);
                setSelectedOrderItems([]);
                fetchSelectedOrderItems(item.id);
                setShowStatusModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={styles.orderIdRow}>
                  <Text style={styles.orderNumber}>#{item.order_number}</Text>
                  <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                  <StatusIcon size={14} color={statusColor} />
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardDetailRow}>
                <View style={styles.detailIconWrap}>
                  <User size={14} color="#ff8c00" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Customer</Text>
                  <Text style={styles.detailValue}>{item.customer.full_name}</Text>
                </View>
              </View>

              <View style={styles.cardDetailRow}>
                <View style={styles.detailIconWrap}>
                  <Store size={14} color="#f59e0b" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Vendor</Text>
                  <Text style={styles.detailValue}>{item.vendor.business_name}</Text>
                </View>
              </View>

              <View style={styles.cardDetailRow}>
                <View style={styles.detailIconWrap}>
                  <MapPin size={14} color="#10b981" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Delivery</Text>
                  <Text style={styles.detailValue}>
                    {item.delivery_type === 'pickup' ? 'Pickup' : 'Delivery'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDetailRow}>
                <View style={styles.detailIconWrap}>
                  <CreditCard size={14} color="#3b82f6" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Payment</Text>
                  <Text style={styles.detailValue}>{getPaymentLabel(item.payment_method)}</Text>
                </View>
                {item.payment_method === 'transfer' && (
                  <>
                    {item.payment_status === 'completed' ? (
                      <View style={styles.paidBadge}>
                        <CheckCircle size={12} color="#059669" />
                        <Text style={styles.paidText}>Paid</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.markPaidButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          markAsPaid(item);
                        }}
                      >
                        <Text style={styles.markPaidText}>Mark Paid</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.editBtnSmall}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(item);
                    setShowStatusModal(true);
                  }}
                >
                  <Edit3 size={14} color="#ff8c00" />
                  <Text style={styles.editBtnText}>Update</Text>
                </TouchableOpacity>
                <Text style={styles.totalAmount}>
                  {'\u20A6'}{Number(item.total).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Status</Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity
                  style={styles.receiptButton}
                  onPress={() => {
                    if (selectedOrder) handleViewReceipt(selectedOrder);
                  }}
                >
                  <Receipt size={18} color="#ff8c00" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setShowStatusModal(false); setSelectedOrderItems([]); }}
                  style={styles.closeButton}
                >
                  <X size={22} color="#8b909a" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {selectedOrder && (
                <>
                  <View style={styles.modalOrderInfo}>
                    <Text style={styles.modalOrderNumber}>
                      Order #{selectedOrder.order_number}
                    </Text>
                    <Text style={styles.modalCustomer}>{selectedOrder.customer.full_name}</Text>
                    <Text style={styles.modalTotal}>
                      {'\u20A6'}{Number(selectedOrder.total).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <View style={styles.modalDetailSection}>
                    <View style={styles.modalDetailRow}>
                      <Store size={14} color="#f59e0b" />
                      <Text style={styles.modalDetailLabel}>Vendor</Text>
                      <Text style={styles.modalDetailValue}>{selectedOrder.vendor.business_name}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <User size={14} color="#6b7280" />
                      <Text style={styles.modalDetailLabel}>Phone</Text>
                      <Text style={styles.modalDetailValue}>{selectedOrder.customer.phone || 'N/A'}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <MapPin size={14} color="#10b981" />
                      <Text style={styles.modalDetailLabel}>Address</Text>
                      <Text style={[styles.modalDetailValue, { flex: 1, flexWrap: 'wrap' }]}>
                        {selectedOrder.delivery_type === 'pickup'
                          ? (selectedOrder as any).pickup_address || 'Pickup'
                          : selectedOrder.delivery_address || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalSectionLabel}>Order Items</Text>
                  <View style={styles.modalItemsContainer}>
                    {loadingItems ? (
                      <ActivityIndicator size="small" color="#ff8c00" style={{ paddingVertical: 12 }} />
                    ) : selectedOrderItems.length === 0 ? (
                      <Text style={styles.modalNoItems}>No items found</Text>
                    ) : (
                      selectedOrderItems.map((item) => (
                        <View key={item.id} style={styles.modalItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalItemName}>{item.products?.name || 'Product'}</Text>
                            <Text style={styles.modalItemQty}>
                              Qty: {item.quantity}
                              {(item as any).selected_size ? ` · Size: ${(item as any).selected_size}` : ''}
                              {(item as any).selected_color ? ` · ${(item as any).selected_color}` : ''}
                            </Text>
                          </View>
                          <Text style={styles.modalItemPrice}>
                            {'\u20A6'}{(Number(item.unit_price) * item.quantity).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  <Text style={styles.modalSectionLabel}>Set Status</Text>

                  <View style={styles.statusOptions}>
                    {statusOptions.map((option) => {
                      const OptionIcon = statusIcons[option.value];
                      const optionColor = statusColors[option.value];
                      const optionBg = statusBgColors[option.value];
                      const isSelected = selectedOrder.status === option.value;

                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.statusOption,
                            isSelected && { backgroundColor: optionBg, borderColor: optionColor },
                          ]}
                          onPress={() => updateOrderStatus(selectedOrder.id, option.value)}
                          disabled={updatingStatus}
                          activeOpacity={0.6}
                        >
                          <View style={[styles.statusOptionIcon, { backgroundColor: optionBg }]}>
                            <OptionIcon size={18} color={optionColor} />
                          </View>
                          <Text style={[styles.statusOptionText, isSelected && { color: optionColor }]}>
                            {option.label}
                          </Text>
                          {isSelected && (
                            <View style={[styles.selectedDot, { backgroundColor: optionColor }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {updatingStatus && (
                    <View style={styles.updatingContainer}>
                      <ActivityIndicator size="small" color="#ff8c00" />
                      <Text style={styles.updatingText}>Updating...</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.deleteOrderBtn}
                    onPress={() => {
                      setShowStatusModal(false);
                      setTimeout(() => confirmDelete(selectedOrder), 300);
                    }}
                    disabled={deletingOrder || updatingStatus}
                  >
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={styles.deleteOrderBtnText}>Delete Order</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIcon}>
              <Trash2 size={28} color="#dc2626" />
            </View>
            <Text style={styles.confirmTitle}>Delete Order</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete order #{orderToDelete?.order_number}? This cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => {
                  setShowDeleteConfirmation(false);
                  setOrderToDelete(null);
                }}
                disabled={deletingOrder}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => orderToDelete && deleteOrder(orderToDelete.id)}
                disabled={deletingOrder}
              >
                {deletingOrder ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <OrderReceipt
        visible={showReceipt}
        order={receiptOrder}
        orderItems={orderItems}
        onClose={() => {
          setShowReceipt(false);
          setReceiptOrder(null);
          setOrderItems([]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
  },

  // Header
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#ffffff',
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,

  // Filter tabs
  filterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#ff8c00',
  },
  filterTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 11,
    color: '#8b909a',
  },
  filterBadgeTextActive: {
    color: '#ffffff',
  },

  // List
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#9ca3af',
  },

  // Order Card
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  orderIdRow: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: Fonts.groteskBold,
    color: '#1a1d23',
  },
  orderDate: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    flexShrink: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f0f1f3',
    marginBottom: 12,
  },

  // Detail rows
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  detailIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f8f9fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
    marginTop: 1,
  },

  // Payment badges
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  paidText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#059669',
  },
  markPaidButton: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  markPaidText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f1f3',
  },
  editBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  editBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: '#ff8c00',
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
    letterSpacing: -0.3,
  },

  // Status Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '82%',
    flexShrink: 1,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1a1d23',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  receiptButton: {
    backgroundColor: '#fff7ed',
    padding: 10,
    borderRadius: 10,
  },
  closeButton: {
    padding: 4,
  },
  modalOrderInfo: {
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  modalOrderNumber: {
    fontSize: 16,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
    marginBottom: 2,
  },
  modalCustomer: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 6,
  },
  modalTotal: {
    fontSize: 22,
    fontFamily: Fonts.groteskBold,
    color: '#1a1d23',
    letterSpacing: -0.3,
  },
  modalSectionLabel: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    color: '#8b909a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusOptions: {
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f0f1f3',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  statusOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOptionText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#374151',
    flex: 1,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  updatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    gap: 8,
  },
  updatingText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#8b909a',
  },
  deleteOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  deleteOrderBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },

  modalDetailSection: {
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalDetailLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    width: 56,
    paddingTop: 1,
  },
  modalDetailValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
  },
  modalItemsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    overflow: 'hidden',
    marginBottom: 20,
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f3',
    gap: 8,
  },
  modalItemName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
    marginBottom: 2,
  },
  modalItemQty: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  modalItemPrice: {
    fontSize: 13,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
  },
  modalNoItems: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    textAlign: 'center',
    padding: 16,
  },

  // Delete Confirmation Modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1a1d23',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fb',
  },
  confirmCancelText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  confirmDeleteText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
