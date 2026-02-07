import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Package,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Clock,
  XCircle,
  Star,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import VendorOrderManagement from '@/components/marketplace/vendor/VendorOrderManagement';
import { Fonts } from '@/constants/fonts';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  totalReviews: number;
  averageRating: number;
}

export default function VendorHome() {
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalReviews: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showOrders, setShowOrders] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const fetchDashboardStats = async (isInitialLoad = false) => {
    if (!profile || !vendorId) return;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const [productsResult, ordersResult, reviewsResult] = await Promise.all([
        supabase.from('products').select('*').eq('vendor_id', vendorId),
        supabase
          .from('orders')
          .select('*, order_items(product_id, quantity, unit_price)')
          .eq('vendor_id', vendorId),
        supabase
          .from('reviews')
          .select('rating')
          .in('product_id',
            (await supabase.from('products').select('id').eq('vendor_id', vendorId)).data?.map(p => p.id) || []
          ),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const products = productsResult.data || [];
      const orders = ordersResult.data || [];

      const activeProducts = products.filter((p) => p.is_available).length;
      const lowStockProducts = products.filter((p) => p.stock_quantity < 10).length;
      const completedOrders = orders.filter((o) => o.status === 'delivered').length;
      const pendingOrders = orders.filter(
        (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
      ).length;
      const totalRevenue = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      const reviews = reviewsResult.data || [];
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

      setStats({
        totalProducts: products.length,
        activeProducts,
        lowStockProducts,
        totalRevenue,
        pendingOrders,
        completedOrders,
        totalReviews,
        averageRating,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (profile) {
      setVendorId(profile.id);
      fetchVendorBanner();
    }
  }, [profile]);

  const fetchVendorBanner = async () => {
    if (!profile) return;

    try {
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (vendorData) {
        const { data: settingsData } = await supabase
          .from('vendor_settings')
          .select('store_banner_url')
          .eq('vendor_id', vendorData.id)
          .maybeSingle();

        if (settingsData?.store_banner_url) {
          setBannerUrl(settingsData.store_banner_url);
        }
      }
    } catch (error) {
      console.error('Error fetching vendor banner:', error);
    }
  };

  useEffect(() => {
    if (!vendorId) return;

    fetchDashboardStats(true);

    const productsChannel = supabase
      .channel('vendor-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => fetchDashboardStats(false)
      )
      .subscribe();

    const ordersChannel = supabase
      .channel('vendor-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => fetchDashboardStats(false)
      )
      .subscribe();

    const reviewsChannel = supabase
      .channel('vendor-reviews-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
        },
        () => fetchDashboardStats(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(reviewsChannel);
    };
  }, [vendorId]);

  useEffect(() => {
    if (!profile) return;

    const getVendorIdForSettings = async () => {
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();
      return vendorData?.id;
    };

    const setupSettingsSubscription = async () => {
      const vendorSettingsId = await getVendorIdForSettings();
      if (!vendorSettingsId) return;

      const settingsChannel = supabase
        .channel('vendor-settings-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'vendor_settings',
            filter: `vendor_id=eq.${vendorSettingsId}`,
          },
          (payload) => {
            const newBannerUrl = payload.new.store_banner_url;
            setBannerUrl(newBannerUrl || null);
          }
        )
        .subscribe();

      return settingsChannel;
    };

    let settingsChannel: any;
    setupSettingsSubscription().then(channel => {
      settingsChannel = channel;
    });

    return () => {
      if (settingsChannel) {
        supabase.removeChannel(settingsChannel);
      }
    };
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (vendorId) {
        fetchDashboardStats();
      }
    }, [vendorId])
  );

  if (showOrders) {
    return <VendorOrderManagement onBack={() => setShowOrders(false)} />;
  }

  if (profile?.vendor_status === 'pending') {
    return (
      <View style={[styles.statusContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.statusIconWrap}>
          <View style={styles.statusIconInner}>
            <Clock size={48} color="#d97706" />
          </View>
        </View>
        <Text style={styles.statusTitle}>Application Under Review</Text>
        <Text style={styles.statusText}>
          Your vendor application is being reviewed by our admin team. You'll receive an email once
          your account is approved.
        </Text>
        <View style={styles.statusTimeBadge}>
          <Clock size={14} color="#92400e" />
          <Text style={styles.statusTimeText}>Usually takes 24-48 hours</Text>
        </View>
        <TouchableOpacity
          style={styles.statusButton}
          onPress={async () => {
            await signOut();
            router.replace('/auth/login');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.statusButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (profile?.vendor_status === 'rejected') {
    return (
      <View style={[styles.statusContainer, { paddingTop: insets.top + 40 }]}>
        <View style={[styles.statusIconWrap, styles.statusIconRejected]}>
          <View style={[styles.statusIconInner, { backgroundColor: '#fef2f2' }]}>
            <XCircle size={48} color="#dc2626" />
          </View>
        </View>
        <Text style={styles.statusTitle}>Application Rejected</Text>
        <Text style={styles.statusText}>
          Unfortunately, your vendor application was not approved.
        </Text>
        {profile.rejection_reason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionTitle}>Reason</Text>
            <Text style={styles.rejectionText}>{profile.rejection_reason}</Text>
          </View>
        )}
        <Text style={styles.statusText}>Please contact support for more information.</Text>
        <TouchableOpacity
          style={styles.statusButton}
          onPress={async () => {
            await signOut();
            router.replace('/auth/login');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.statusButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Vendor';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}</Text>
            <Text style={styles.subtitle}>Here's your store at a glance</Text>
          </View>
          <View style={styles.headerBadge}>
            <BarChart3 size={20} color="#ff8c00" />
          </View>
        </View>
      </View>

      {bannerUrl && (
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: bannerUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View style={styles.revenueIconWrap}>
              <DollarSign size={20} color="#ffffff" />
            </View>
            <View style={styles.revenueLabelWrap}>
              <Text style={styles.revenueLabel}>Total Revenue</Text>
            </View>
          </View>
          <Text style={styles.revenueValue}>
            {'\u20A6'}{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.revenueMeta}>
            <Text style={styles.revenueMetaText}>
              {stats.completedOrders} completed order{stats.completedOrders !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#fff7ed' }]}>
              <ShoppingBag size={18} color="#ea580c" />
            </View>
            <Text style={styles.metricValue}>{stats.pendingOrders}</Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#f0fdf4' }]}>
              <Package size={18} color="#16a34a" />
            </View>
            <Text style={styles.metricValue}>{stats.activeProducts}</Text>
            <Text style={styles.metricLabel}>Products</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#eff6ff' }]}>
              <TrendingUp size={18} color="#2563eb" />
            </View>
            <Text style={styles.metricValue}>{stats.completedOrders}</Text>
            <Text style={styles.metricLabel}>Delivered</Text>
          </View>
        </View>

        <View style={styles.ratingsRow}>
          <View style={styles.ratingCard}>
            <View style={styles.ratingTop}>
              <Star size={18} color="#eab308" fill="#eab308" />
              <Text style={styles.ratingValue}>
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '--'}
              </Text>
            </View>
            <Text style={styles.ratingLabel}>Avg Rating</Text>
          </View>
          <View style={styles.ratingCard}>
            <View style={styles.ratingTop}>
              <Star size={18} color="#ff8c00" />
              <Text style={styles.ratingValue}>{stats.totalReviews}</Text>
            </View>
            <Text style={styles.ratingLabel}>Reviews</Text>
          </View>
        </View>

        {stats.lowStockProducts > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertIconWrap}>
              <AlertTriangle size={18} color="#d97706" />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Low Stock Alert</Text>
              <Text style={styles.alertText}>
                {stats.lowStockProducts} product{stats.lowStockProducts !== 1 ? 's' : ''} running low
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(marketplace)/vendor')} activeOpacity={0.7}>
              <ChevronRight size={18} color="#d97706" />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(marketplace)/vendor')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#f0fdf4' }]}>
              <Package size={20} color="#16a34a" />
            </View>
            <Text style={styles.actionTitle}>Products</Text>
            <Text style={styles.actionSub}>Manage inventory</Text>
            <View style={styles.actionArrow}>
              <ArrowUpRight size={14} color="#16a34a" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setShowOrders(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#eff6ff' }]}>
              <ShoppingBag size={20} color="#2563eb" />
            </View>
            <Text style={styles.actionTitle}>Orders</Text>
            <Text style={styles.actionSub}>Track & fulfill</Text>
            <View style={styles.actionArrow}>
              <ArrowUpRight size={14} color="#2563eb" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Store Summary</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Products</Text>
            <Text style={styles.summaryValue}>{stats.totalProducts}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Active Listings</Text>
            <Text style={styles.summaryValue}>{stats.activeProducts}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Low Stock Items</Text>
            <Text style={[styles.summaryValue, stats.lowStockProducts > 0 && styles.warnValue]}>
              {stats.lowStockProducts}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
  },
  header: {
    backgroundColor: '#2d1f12',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.dmSansBold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerImage: {
    width: '100%',
    height: 160,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  revenueCard: {
    backgroundColor: '#2d1f12',
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  revenueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  revenueIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ff8c00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueLabelWrap: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 14,
    fontFamily: Fonts.dmSansMedium,
    color: '#94a3b8',
    letterSpacing: 0.2,
  },
  revenueValue: {
    fontSize: 32,
    fontFamily: Fonts.dmSansBold,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  revenueMeta: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  revenueMetaText: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#64748b',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: Fonts.dmSansMedium,
    color: '#64748b',
  },
  ratingsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  ratingCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  ratingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ratingValue: {
    fontSize: 20,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
  },
  ratingLabel: {
    fontSize: 12,
    fontFamily: Fonts.dmSansMedium,
    color: '#64748b',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#92400e',
  },
  alertText: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#a16207',
    marginTop: 1,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 12,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
  },
  actionArrow: {
    position: 'absolute',
    top: 18,
    right: 18,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f0ebe4',
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: Fonts.dmSans,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#1a1a1a',
  },
  warnValue: {
    color: '#d97706',
  },
  statusContainer: {
    flex: 1,
    backgroundColor: '#f8f5f0',
    alignItems: 'center',
    padding: 32,
  },
  statusIconWrap: {
    marginBottom: 28,
  },
  statusIconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fef9ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconRejected: {},
  statusTitle: {
    fontSize: 22,
    fontFamily: Fonts.dmSansBold,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  statusText: {
    fontSize: 15,
    fontFamily: Fonts.dmSans,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 23,
    maxWidth: 320,
  },
  statusTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 28,
  },
  statusTimeText: {
    fontSize: 13,
    fontFamily: Fonts.dmSansMedium,
    color: '#92400e',
  },
  statusButton: {
    backgroundColor: '#2d1f12',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  statusButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
  },
  rejectionBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 360,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#991b1b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rejectionText: {
    fontSize: 14,
    fontFamily: Fonts.dmSans,
    color: '#7f1d1d',
    lineHeight: 21,
  },
});
