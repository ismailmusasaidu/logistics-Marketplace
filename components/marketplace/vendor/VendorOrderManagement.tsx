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
  Platform,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Clock, CircleCheck as CheckCircle, Truck, Circle as XCircle, ArrowLeft, ShoppingBag, Search, Receipt, X, ChevronRight, User, MapPin, CreditCard, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Order, OrderStatus, OrderItem, Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Fonts } from '@/constants/fonts';
import OrderReceipt from '@/components/marketplace/OrderReceipt';

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
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  ready_for_pickup: '#06b6d4',
  out_for_delivery: '#f97316',
  delivered: '#059669',
  cancelled: '#ef4444',
};

const statusBgColors: Record<OrderStatus, string> = {
  pending: '#fef3c7',
  confirmed: '#dbeafe',
  preparing: '#ede9fe',
  ready_for_pickup: '#cffafe',
  out_for_delivery: '#ffedd5',
  delivered: '#d1fae5',
  cancelled: '#fee2e2',
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

interface OrderWithCustomer extends Order {
  customer: {
    full_name: string;
    email: string;
    phone: string | null;
  };
}

interface OrderItemWithProduct extends OrderItem {
  products: Product;
}

interface VendorOrderManagementProps {
  onBack?: () => void;
}

const PAGE_SIZE = 20;

export default function VendorOrderManagement({ onBack }: VendorOrderManagementProps) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [showDetailPage, setShowDetailPage] = useState(false);
  const detailSlide = useRef(new Animated.Value(0)).current;
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [orderItemsCache, setOrderItemsCache] = useState<Record<string, OrderItemWithProduct[]>>({});

  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;

  useEffect(() => {
    if (profile) {
      setVendorId(profile.id);
    }
  }, [profile]);

  const buildQuery = useCallback((vid: string, search: string, from: number, to: number) => {
    let q = supabase
      .from('orders')
      .select(`*, customer:profiles!orders_customer_id_fkey(full_name, email, phone)`, { count: 'exact' })
      .eq('vendor_id', vid)
      .eq('order_source', 'marketplace')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search.trim()) {
      q = q.or(`order_number.ilike.%${search.trim()}%,id.ilike.%${search.trim()}%`);
    }
    return q;
  }, []);

  const fetchOrders = useCallback(async (vid: string, search: string) => {
    try {
      setLoading(true);
      setPage(0);
      const { data, error, count } = await buildQuery(vid, search, 0, PAGE_SIZE - 1);
      if (error) throw error;
      const formatted: OrderWithCustomer[] = (data || []).map((o: any) => ({
        ...o,
        customer: o.customer || { full_name: 'Unknown', email: 'N/A', phone: null },
      }));
      setOrders(formatted);
      setTotalCount(count ?? 0);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !vendorId) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { data, error } = await buildQuery(vendorId, searchRef.current, from, to);
      if (error) throw error;
      const formatted: OrderWithCustomer[] = (data || []).map((o: any) => ({
        ...o,
        customer: o.customer || { full_name: 'Unknown', email: 'N/A', phone: null },
      }));
      setOrders((prev) => [...prev, ...formatted]);
      setPage(nextPage);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more orders:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, vendorId, page, buildQuery]);

  useEffect(() => {
    if (!vendorId) return;
    fetchOrders(vendorId, searchQuery);
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const timer = setTimeout(() => {
      fetchOrders(vendorId, searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel('vendor-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` }, (payload) => {
        const newOrder = payload.new as any;
        const formatted: OrderWithCustomer = {
          ...newOrder,
          customer: { full_name: 'Unknown', email: 'N/A', phone: null },
        };
        setOrders((prev) => [formatted, ...prev]);
        setTotalCount((c) => c + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` }, (payload) => {
        const updated = payload.new as any;
        setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o));
        if (selectedOrder?.id === updated.id) {
          setSelectedOrder((prev) => prev ? { ...prev, ...updated } : prev);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        const deleted = payload.old as Order;
        setOrders((prev) => prev.filter((o) => o.id !== deleted.id));
        setTotalCount((c) => Math.max(0, c - 1));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [vendorId, selectedOrder?.id]);

  const openDetailPage = (order: OrderWithCustomer) => {
    setSelectedOrder(order);
    setSelectedOrderItems([]);
    fetchSelectedOrderItems(order.id);
    setShowDetailPage(true);
    detailSlide.setValue(1);
    Animated.spring(detailSlide, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  };

  const closeDetailPage = () => {
    Animated.timing(detailSlide, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setShowDetailPage(false);
      setSelectedOrder(null);
      setSelectedOrderItems([]);
    });
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(true);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      setShowStatusModal(false);
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const markAsPaid = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, payment_status: 'completed' });
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error);
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderItem = ({ item }: { item: OrderWithCustomer }) => {
    const StatusIcon = statusIcons[item.status];
    const statusColor = statusColors[item.status];
    const statusBg = statusBgColors[item.status];

    return (
      <Pressable
        style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
        onPress={() => openDetailPage(item)}
      >
        <View style={styles.orderCardTop}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>#{item.order_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <StatusIcon size={13} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
          <View style={styles.customerRow}>
            <User size={14} color="#78716c" />
            <Text style={styles.customerName}>{item.customer.full_name}</Text>
          </View>
        </View>

        <View style={styles.orderCardDivider} />

        <View style={styles.orderCardBottom}>
          <View style={styles.orderMetaItem}>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.metaValue}>{'\u20A6'}{parseFloat(item.total.toString()).toLocaleString()}</Text>
          </View>
          <View style={styles.orderMetaItem}>
            <Text style={styles.metaLabel}>Delivery</Text>
            <Text style={styles.metaValueSmall}>{item.delivery_type || 'N/A'}</Text>
          </View>
          <View style={styles.orderMetaItem}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValueSmall}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.updateStatusBtn}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedOrder(item);
            setShowStatusModal(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.updateStatusText}>Update Status</Text>
          <ChevronRight size={16} color="#1a1a1a" />
        </TouchableOpacity>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#fafaf9" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Orders</Text>
          {totalCount > 0 && (
            <View style={styles.orderCountBadge}>
              <Text style={styles.orderCountText}>{totalCount.toLocaleString()}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#a8a29e" />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Search orders..."
            placeholderTextColor="#a8a29e"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X size={16} color="#78716c" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#ff8c00" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                {searchQuery ? <Search size={48} color="#d6d3d1" /> : <Package size={48} color="#d6d3d1" />}
              </View>
              <Text style={styles.emptyTitle}>{searchQuery ? 'No results' : 'No orders yet'}</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'Orders from customers will appear here'}
              </Text>
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearchText}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusModal(false)}>
          <Pressable style={styles.statusModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.statusModalHeader}>
              <Text style={styles.statusModalTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <X size={22} color="#78716c" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statusList} showsVerticalScrollIndicator={false}>
              {statusOptions.map((option) => {
                const StatusIcon = statusIcons[option.value];
                const isSelected = selectedOrder?.status === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.statusOption, isSelected && styles.statusOptionActive]}
                    onPress={() => {
                      if (selectedOrder) {
                        updateOrderStatus(selectedOrder.id, option.value);
                      }
                    }}
                    disabled={updatingStatus}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusOptionIcon, { backgroundColor: statusBgColors[option.value] }]}>
                      <StatusIcon size={18} color={statusColors[option.value]} />
                    </View>
                    <Text style={[styles.statusOptionText, isSelected && styles.statusOptionTextActive]}>{option.label}</Text>
                    {isSelected && <CheckCircle size={18} color="#1a1a1a" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {updatingStatus && (
              <View style={styles.updatingOverlay}>
                <ActivityIndicator size="large" color="#1a1a1a" />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Order Details Page */}
      {showDetailPage && selectedOrder && (
        <Animated.View
          style={[
            styles.detailPage,
            { transform: [{ translateX: detailSlide.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) }] },
          ]}
        >
          <View style={[styles.detailPageHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={closeDetailPage} style={styles.detailBackBtn} activeOpacity={0.7}>
              <ArrowLeft size={22} color="#fafaf9" />
            </TouchableOpacity>
            <Text style={styles.detailPageTitle}>Order Details</Text>
            <TouchableOpacity
              style={styles.detailReceiptBtn}
              onPress={() => handleViewReceipt(selectedOrder)}
              activeOpacity={0.7}
            >
              <Receipt size={18} color="#fafaf9" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.detailsBody}
            contentContainerStyle={[styles.detailsBodyContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Package size={16} color="#78716c" />
                <Text style={styles.detailSectionTitle}>Order Info</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order No.</Text>
                  <Text style={styles.detailValue}>#{selectedOrder.order_number}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusBgColors[selectedOrder.status] }]}>
                    {(() => {
                      const Icon = statusIcons[selectedOrder.status];
                      return <Icon size={13} color={statusColors[selectedOrder.status]} />;
                    })()}
                    <Text style={[styles.statusText, { color: statusColors[selectedOrder.status] }]}>
                      {selectedOrder.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedOrder.created_at)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <User size={16} color="#78716c" />
                <Text style={styles.detailSectionTitle}>Customer</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{selectedOrder.customer.full_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedOrder.customer.email}</Text>
                </View>
                {selectedOrder.customer.phone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer.phone}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <MapPin size={16} color="#78716c" />
                <Text style={styles.detailSectionTitle}>Delivery</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedOrder.delivery_type || 'N/A'}</Text>
                </View>
                {selectedOrder.delivery_address && selectedOrder.delivery_address !== 'N/A' && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Address</Text>
                    <Text style={[styles.detailValue, { maxWidth: '60%', textAlign: 'right' }]}>{selectedOrder.delivery_address}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Package size={16} color="#78716c" />
                <Text style={styles.detailSectionTitle}>Order Items</Text>
              </View>
              <View style={styles.detailCard}>
                {loadingItems ? (
                  <ActivityIndicator size="small" color="#ff8c00" style={{ paddingVertical: 10 }} />
                ) : selectedOrderItems.length === 0 ? (
                  <Text style={styles.noItemsText}>No items found</Text>
                ) : (
                  selectedOrderItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemRow,
                        index < selectedOrderItems.length - 1 && styles.itemRowBorder,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.products?.name || 'Product'}</Text>
                        <Text style={styles.itemQty}>
                          Qty: {item.quantity} × ₦{Number(item.unit_price).toLocaleString()}
                          {(item as any).selected_size ? `\nSize: ${(item as any).selected_size}` : ''}
                          {(item as any).selected_color ? `  ${(item as any).selected_color}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        ₦{(Number(item.unit_price) * item.quantity).toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <CreditCard size={16} color="#78716c" />
                <Text style={styles.detailSectionTitle}>Payment</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Method</Text>
                  <Text style={styles.detailValueAccent}>
                    {selectedOrder.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' :
                     selectedOrder.payment_method === 'wallet' ? 'Wallet' :
                     selectedOrder.payment_method === 'online' ? 'Online Payment' :
                     'Bank Transfer'}
                  </Text>
                </View>
                {selectedOrder.payment_method === 'transfer' && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    {selectedOrder.payment_status === 'completed' ? (
                      <View style={styles.paidBadge}>
                        <CheckCircle size={13} color="#059669" />
                        <Text style={styles.paidText}>Paid</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.markPaidBtn}
                        onPress={() => markAsPaid(selectedOrder.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.markPaidText}>Mark as Paid</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{'\u20A6'}{parseFloat(selectedOrder.total.toString()).toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.updateStatusPageBtn}
              onPress={() => setShowStatusModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.updateStatusPageText}>Update Order Status</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      )}

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
    backgroundColor: '#f8f5f0',
  },
  header: {
    backgroundColor: '#2d1f12',
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: Fonts.groteskBold,
    color: '#fafaf9',
    letterSpacing: -0.5,
  },
  orderCountBadge: {
    backgroundColor: '#ff8c00',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  orderCountText: {
    fontSize: 13,
    fontFamily: Fonts.groteskSemiBold,
    color: '#fff',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ede8e0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.grotesk,
    color: '#1a1a1a',
    marginLeft: 10,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#ede8e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.groteskSemiBold,
    color: '#44403c',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.grotesk,
    color: '#a8a29e',
  },
  clearSearchBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#2d1f12',
    borderRadius: 10,
  },
  clearSearchText: {
    fontSize: 14,
    fontFamily: Fonts.groteskSemiBold,
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ede8e0',
  },
  orderCardPressed: {
    backgroundColor: '#faf8f5',
  },
  orderCardTop: {
    marginBottom: 12,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 16,
    fontFamily: Fonts.groteskBold,
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Fonts.groteskSemiBold,
    textTransform: 'capitalize',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 14,
    fontFamily: Fonts.groteskMedium,
    color: '#78716c',
  },
  orderCardDivider: {
    height: 1,
    backgroundColor: '#f8f5f0',
    marginBottom: 12,
  },
  orderCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  orderMetaItem: {
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 11,
    fontFamily: Fonts.groteskMedium,
    color: '#a8a29e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 16,
    fontFamily: Fonts.groteskBold,
    color: '#1a1a1a',
  },
  metaValueSmall: {
    fontSize: 13,
    fontFamily: Fonts.groteskMedium,
    color: '#44403c',
  },
  updateStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#faf8f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ede8e0',
    gap: 6,
  },
  updateStatusText: {
    fontSize: 14,
    fontFamily: Fonts.groteskSemiBold,
    color: '#1a1a1a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d6d3d1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  statusModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  statusModalTitle: {
    fontSize: 20,
    fontFamily: Fonts.groteskBold,
    color: '#1a1a1a',
  },
  statusList: {
    padding: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  statusOptionActive: {
    borderColor: '#2d1f12',
    backgroundColor: '#faf8f5',
  },
  statusOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.groteskMedium,
    color: '#44403c',
  },
  statusOptionTextActive: {
    fontFamily: Fonts.groteskBold,
    color: '#1a1a1a',
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  detailPage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8f5f0',
    zIndex: 10,
  },
  detailPageHeader: {
    backgroundColor: '#2d1f12',
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPageTitle: {
    fontSize: 20,
    fontFamily: Fonts.groteskBold,
    color: '#fafaf9',
    letterSpacing: -0.3,
  },
  detailReceiptBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateStatusPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d1f12',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  updateStatusPageText: {
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
    color: '#fff',
  },
  detailsBody: {
    flexGrow: 1,
    flexShrink: 1,
  },
  detailsBodyContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.groteskSemiBold,
    color: '#78716c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailCard: {
    backgroundColor: '#faf8f5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: Fonts.grotesk,
    color: '#a8a29e',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.groteskMedium,
    color: '#1a1a1a',
  },
  detailValueAccent: {
    fontSize: 14,
    fontFamily: Fonts.groteskSemiBold,
    color: '#ff8c00',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  paidText: {
    fontSize: 12,
    fontFamily: Fonts.groteskSemiBold,
    color: '#059669',
  },
  markPaidBtn: {
    backgroundColor: '#2d1f12',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  markPaidText: {
    fontSize: 13,
    fontFamily: Fonts.groteskSemiBold,
    color: '#fff',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ede8e0',
    marginTop: 6,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
    color: '#44403c',
  },
  totalValue: {
    fontSize: 20,
    fontFamily: Fonts.groteskBold,
    color: '#1a1a1a',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 8,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ede8e0',
  },
  itemName: {
    fontSize: 14,
    fontFamily: Fonts.groteskSemiBold,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  itemQty: {
    fontSize: 12,
    fontFamily: Fonts.grotesk,
    color: '#a8a29e',
  },
  itemTotal: {
    fontSize: 14,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
  },
  noItemsText: {
    fontSize: 13,
    fontFamily: Fonts.grotesk,
    color: '#a8a29e',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
