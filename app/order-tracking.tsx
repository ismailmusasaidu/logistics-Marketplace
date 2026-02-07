import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Package,
  Truck,
  MapPin,
  Phone,
  Calendar,
  ShoppingBag,
  XCircle,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Order, OrderStatus } from '@/types/database';
import OrderItemsList from '@/components/marketplace/OrderItemsList';
import { Fonts } from '@/constants/fonts';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product: {
    name: string;
    image_url: string;
  };
}

interface OrderWithItems extends Order {
  items: OrderItem[];
  vendor: {
    business_name: string;
    address: string;
  };
}

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

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusSteps: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'preparing', label: 'Preparing', icon: Package },
  { status: 'ready_for_pickup', label: 'Ready for Pickup', icon: ShoppingBag },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();

      // Set up real-time subscription
      const channel = supabase
        .channel(`order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            if (payload.new) {
              setOrder((prev) => (prev ? { ...prev, ...payload.new } : null));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          order_items (
            id,
            quantity,
            unit_price,
            subtotal,
            products (
              name,
              image_url
            )
          )
        `
        )
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (!data) {
        setOrder(null);
        return;
      }

      // Fetch vendor info separately
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('business_name, address')
        .eq('user_id', data.vendor_id)
        .maybeSingle();

      const formattedOrder: OrderWithItems = {
        ...data,
        items: (data.order_items || []).map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          product: {
            name: item.products?.name || 'Unknown Product',
            image_url: item.products?.image_url || '',
          },
        })),
        vendor: {
          business_name: vendorData?.business_name || 'Unknown Vendor',
          address: vendorData?.address || 'N/A',
        },
      };

      setOrder(formattedOrder);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatStepTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStepTimestamp = (status: OrderStatus): string | null => {
    if (!order) return null;
    const timestamps: Record<string, string | null> = {
      'pending': order.created_at,
      'confirmed': (order as any).confirmed_at || null,
      'preparing': (order as any).preparing_at || null,
      'ready_for_pickup': (order as any).ready_for_pickup_at || null,
      'out_for_delivery': (order as any).out_for_delivery_at || null,
      'delivered': (order as any).delivered_at || null,
    };
    return timestamps[status];
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    if (order.status === 'cancelled') return -1;
    return statusSteps.findIndex((step) => step.status === order.status);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = order.status === 'cancelled';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusHeaderTitle}>Current Status</Text>
          </View>
          <View style={styles.currentStatusContainer}>
            <View
              style={[
                styles.currentStatusIconContainer,
                { backgroundColor: statusColors[order.status] },
              ]}
            >
              {(() => {
                const StatusIcon = statusIcons[order.status];
                return <StatusIcon size={32} color="#ffffff" />;
              })()}
            </View>
            <Text style={[styles.currentStatusText, { color: statusColors[order.status] }]}>
              {statusLabels[order.status]}
            </Text>
          </View>
        </View>

        {!isCancelled && (
          <View style={styles.trackingContainer}>
            {statusSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <View
                  key={step.status}
                  style={styles.stepContainer}
                >
                  <View style={styles.stepIndicator}>
                    <View
                      style={[
                        styles.stepIconContainer,
                        isCompleted && styles.stepIconCompleted,
                        isCurrent && styles.stepIconCurrent,
                      ]}
                    >
                      <StepIcon
                        size={20}
                        color={isCompleted ? '#ffffff' : '#94a3b8'}
                      />
                    </View>
                    {index < statusSteps.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          isCompleted && styles.stepLineCompleted,
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text
                      style={[
                        styles.stepLabel,
                        isCompleted && styles.stepLabelCompleted,
                        isCurrent && styles.stepLabelCurrent,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {isCompleted && getStepTimestamp(step.status) && (
                      <Text style={styles.stepTime}>
                        {formatStepTime(getStepTimestamp(step.status))}
                      </Text>
                    )}
                    {isCurrent && (
                      <Text style={styles.currentStepBadge}>Current Status</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Delivery Information</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Type</Text>
              <Text style={styles.infoValue}>
                {order.delivery_type === 'delivery' ? 'Home Delivery' : 'Pickup'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{order.delivery_address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Vendor Information</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Store Name</Text>
              <Text style={styles.infoValue}>{order.vendor.business_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Store Address</Text>
              <Text style={styles.infoValue}>{order.vendor.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Order Items</Text>
          </View>
          <View style={styles.cardContent}>
            <OrderItemsList orderId={order.id} orderStatus={order.status} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Calendar size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Date</Text>
              <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subtotal</Text>
              <Text style={styles.infoValue}>₦{order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Fee</Text>
              <Text style={styles.infoValue}>₦{order.delivery_fee.toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tax</Text>
              <Text style={styles.infoValue}>₦{order.tax.toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Method</Text>
              <View style={styles.paymentContainer}>
                <Text style={styles.paymentMethod}>
                  {order.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' :
                   order.payment_method === 'wallet' ? 'Wallet' :
                   order.payment_method === 'online' ? 'Online Payment' :
                   'Bank Transfer'}
                </Text>
                {order.payment_method === 'transfer' && order.payment_status === 'completed' && (
                  <View style={styles.paidBadge}>
                    <CheckCircle size={12} color="#059669" />
                    <Text style={styles.paidText}>Paid</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{order.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {order.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Order Notes</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: '#999',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  statusHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe4',
  },
  statusHeaderTitle: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  currentStatusContainer: {
    alignItems: 'center',
    padding: 24,
  },
  currentStatusIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  currentStatusText: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    letterSpacing: 0.3,
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  orderNumber: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  cancelledBanner: {
    backgroundColor: '#fee2e2',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelledText: {
    color: '#dc2626',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  trackingContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 16,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8f5f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f0ebe4',
  },
  stepIconCompleted: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  stepIconCurrent: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  stepLine: {
    width: 3,
    height: 40,
    backgroundColor: '#f0ebe4',
    marginTop: 4,
  },
  stepLineCompleted: {
    backgroundColor: '#ff8c00',
  },
  stepContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 32,
  },
  stepLabel: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#94a3b8',
  },
  stepLabelCompleted: {
    color: '#1a1a1a',
  },
  stepLabelCurrent: {
    color: '#ff8c00',
    fontFamily: Fonts.headingBold,
  },
  stepTime: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#64748b',
  },
  currentStepBadge: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe4',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  cardContent: {
    padding: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#999',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  paymentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  paymentMethod: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.semiBold,
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
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 20,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    letterSpacing: -0.3,
  },
  orderItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1a1a1a',
    marginBottom: 6,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemQuantity: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#999',
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: Fonts.display,
    color: '#c2410c',
  },
  notesText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#4b5563',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});
