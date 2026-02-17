import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Clock, CheckCircle, Truck, XCircle, ShoppingBag, Search, X, Star, Receipt } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Order, OrderStatus, OrderItem, Product } from '@/types/database';
import { router } from 'expo-router';
import ReviewForm from '@/components/marketplace/ReviewForm';
import OrderReceipt from '@/components/marketplace/OrderReceipt';
import { Fonts } from '@/constants/fonts';

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
  out_for_delivery: '#ff8c00',
  delivered: '#059669',
  cancelled: '#ef4444',
};

interface OrderItemWithProduct extends OrderItem {
  product: Product;
  hasReview: boolean;
}

export default function OrdersScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderItems, setOrderItems] = useState<Record<string, OrderItemWithProduct[]>>({});
  const [reviewProduct, setReviewProduct] = useState<{ productId: string; orderId: string } | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);

  useEffect(() => {
    if (profile) {
      fetchOrders();

      const subscription = supabase
        .channel('customer_orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${profile.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setOrders((prev) => [payload.new as Order, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setOrders((prev) =>
                prev.map((order) =>
                  order.id === payload.new.id ? (payload.new as Order) : order
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setOrders((prev) => prev.filter((order) => order.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [profile]);

  useEffect(() => {
    orders.forEach((order) => {
      if (order.status === 'delivered' && !orderItems[order.id]) {
        fetchOrderItems(order.id);
      }
    });
  }, [orders]);

  const fetchOrders = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', profile.id)
        .eq('order_source', 'marketplace')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      const { data: items, error } = await supabase
        .from('order_items')
        .select(`
          *,
          products (*)
        `)
        .eq('order_id', orderId);

      if (error) throw error;

      const itemsWithReviewStatus = await Promise.all(
        (items || []).map(async (item: any) => {
          let hasReview = false;

          if (item.product_id && item.products) {
            const { data: existingReview } = await supabase
              .from('reviews')
              .select('id')
              .eq('user_id', profile!.id)
              .eq('product_id', item.product_id)
              .maybeSingle();

            hasReview = !!existingReview;
          }

          return {
            ...item,
            product: item.products,
            hasReview,
          };
        })
      );

      const validItems = itemsWithReviewStatus.filter(item => item.product !== null);

      setOrderItems((prev) => ({
        ...prev,
        [orderId]: validItems,
      }));
    } catch (error) {
      console.error('Error fetching order items:', error);
    }
  };

  const handleReviewSuccess = () => {
    setReviewProduct(null);
    if (reviewProduct) {
      fetchOrderItems(reviewProduct.orderId);
    }
  };

  const handleViewReceipt = async (order: Order) => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products (*)
        `)
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      console.log('Receipt items:', items);
      console.log('Order:', order);

      setReceiptItems(items || []);
      setReceiptOrder(order);
    } catch (error) {
      console.error('Error fetching receipt data:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status: OrderStatus) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const orderNumber = order.order_number.toString();
    const orderId = order.id.toLowerCase();
    const status = order.status.toLowerCase().replace('_', ' ');
    const total = order.total.toString();
    const address = (order.delivery_address || '').toLowerCase();

    return (
      orderNumber.includes(query) ||
      orderId.includes(query) ||
      status.includes(query) ||
      total.includes(query) ||
      address.includes(query)
    );
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const showEmptyOrders = orders.length === 0;
  const showNoResults = !showEmptyOrders && filteredOrders.length === 0;

  if (showEmptyOrders) {
    return (
      <View style={styles.emptyContainer}>
        <Package size={80} color="#d1d5db" />
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptyText}>Your orders will appear here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>{orders.length} orders</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder="Search by order number, status, or address..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {showNoResults ? (
        <View style={styles.emptyResults}>
          <Search size={64} color="#9ca3af" />
          <Text style={styles.emptyResultsTitle}>No orders found</Text>
          <Text style={styles.emptyResultsText}>Try adjusting your search</Text>
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const StatusIcon = statusIcons[item.status];
            const statusColor = statusColors[item.status];
            const items = orderItems[item.id] || [];

            return (
              <View style={styles.orderCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/order-tracking?orderId=${item.id}`)}
                >
                  <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderNumber}>Order #{item.order_number}</Text>
                      <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <StatusIcon size={16} color={statusColor} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Subtotal</Text>
                      <Text style={styles.detailValue}>₦{item.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Delivery Fee</Text>
                      <Text style={styles.detailValue}>₦{item.delivery_fee.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tax</Text>
                      <Text style={styles.detailValue}>₦{item.tax.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Method</Text>
                      <View style={styles.paymentContainer}>
                        <Text style={styles.paymentMethod}>
                          {item.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' :
                           item.payment_method === 'wallet' ? 'Wallet' :
                           item.payment_method === 'online' ? 'Online Payment' :
                           'Bank Transfer'}
                        </Text>
                        {item.payment_method === 'transfer' && item.payment_status === 'completed' && (
                          <View style={styles.paidBadge}>
                            <CheckCircle size={12} color="#059669" />
                            <Text style={styles.paidText}>Paid</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[styles.detailRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>₦{item.total.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.addressContainer}>
                    <Text style={styles.addressLabel}>Delivery Address</Text>
                    <Text style={styles.addressText}>{item.delivery_address}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.receiptButton}
                  onPress={() => handleViewReceipt(item)}
                  activeOpacity={0.7}
                >
                  <Receipt size={18} color="#ff8c00" />
                  <Text style={styles.receiptButtonText}>View Receipt</Text>
                </TouchableOpacity>

                {item.status === 'delivered' && items.length > 0 && (
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewSectionTitle}>Rate Your Purchase</Text>
                    {items.map((orderItem) => (
                      <View key={orderItem.id} style={styles.reviewItem}>
                        <View style={styles.reviewItemInfo}>
                          <Text style={styles.reviewItemName} numberOfLines={1}>
                            {orderItem.product.name}
                          </Text>
                          <Text style={styles.reviewItemQuantity}>
                            Qty: {orderItem.quantity}
                          </Text>
                        </View>
                        {orderItem.hasReview ? (
                          <View style={styles.reviewedBadge}>
                            <CheckCircle size={14} color="#059669" />
                            <Text style={styles.reviewedText}>Reviewed</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.reviewButton}
                            onPress={() =>
                              setReviewProduct({
                                productId: orderItem.product_id,
                                orderId: item.id,
                              })
                            }
                          >
                            <Star size={14} color="#ff8c00" />
                            <Text style={styles.reviewButtonText}>Review</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!reviewProduct}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReviewProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {reviewProduct && (
              <ReviewForm
                productId={reviewProduct.productId}
                orderId={reviewProduct.orderId}
                onSuccess={handleReviewSuccess}
                onCancel={() => setReviewProduct(null)}
              />
            )}
          </View>
        </View>
      </Modal>

      <OrderReceipt
        visible={!!receiptOrder}
        order={receiptOrder}
        orderItems={receiptItems}
        onClose={() => {
          setReceiptOrder(null);
          setReceiptItems([]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.spaceBold,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.spaceMedium,
    color: '#1a1a1a',
    padding: 0,
    borderWidth: 0,
    outlineWidth: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyResultsTitle: {
    fontSize: 20,
    fontFamily: Fonts.spaceBold,
    color: '#1a1a1a',
    marginTop: 16,
    letterSpacing: -0.3,
  },
  emptyResultsText: {
    fontSize: 14,
    fontFamily: Fonts.spaceRegular,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#ff8c00',
    borderRadius: 10,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearSearchText: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  list: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe4',
    gap: 12,
  },
  orderInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    fontSize: 17,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1a1a1a',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  orderDate: {
    fontSize: 13,
    fontFamily: Fonts.spaceMedium,
    color: '#94a3b8',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
    flexShrink: 1,
  },
  statusText: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    flexShrink: 1,
  },
  orderDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: Fonts.spaceRegular,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: '#1f2937',
  },
  paymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethod: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#ff8c00',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 3,
  },
  paidText: {
    fontSize: 10,
    fontFamily: Fonts.spaceSemiBold,
    color: '#059669',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 22,
    fontFamily: Fonts.spaceBold,
    color: '#c2410c',
    letterSpacing: -0.5,
  },
  addressContainer: {
    backgroundColor: '#f8f5f0',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  addressLabel: {
    fontSize: 11,
    fontFamily: Fonts.spaceSemiBold,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  addressText: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: '#1a1a1a',
    flexWrap: 'wrap',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  receiptButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceSemiBold,
    color: '#ff8c00',
  },
  reviewSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
  },
  reviewSectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1a1a1a',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f8f5f0',
    borderRadius: 10,
  },
  reviewItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  reviewItemName: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  reviewItemQuantity: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  reviewButtonText: {
    fontSize: 12,
    fontFamily: Fonts.spaceSemiBold,
    color: '#ff8c00',
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  reviewedText: {
    fontSize: 12,
    fontFamily: Fonts.spaceSemiBold,
    color: '#059669',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: Fonts.spaceBold,
    color: '#1a1a1a',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
});
