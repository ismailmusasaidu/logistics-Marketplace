import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Store,
  Package,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  ChevronRight,
  ArrowUpRight,
  Shield,
  BarChart3,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect, router } from 'expo-router';
import { Fonts } from '@/constants/fonts';

interface PlatformStats {
  totalUsers: number;
  totalCustomers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  platformRevenue: number;
  pendingOrders: number;
  activeProducts: number;
}

export default function AdminHome() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalCustomers: 0,
    totalVendors: 0,
    totalProducts: 0,
    totalOrders: 0,
    platformRevenue: 0,
    pendingOrders: 0,
    activeProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats();

    const productsChannel = supabase
      .channel('admin-products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchPlatformStats();
      })
      .subscribe();

    const ordersChannel = supabase
      .channel('admin-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchPlatformStats();
      })
      .subscribe();

    const profilesChannel = supabase
      .channel('admin-profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchPlatformStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPlatformStats();
    }, [])
  );

  const fetchPlatformStats = async () => {
    try {
      setLoading(true);

      const [profilesResult, productsResult, ordersResult] = await Promise.all([
        supabase.from('profiles').select('role'),
        supabase.from('products').select('is_available'),
        supabase.from('orders').select('status, total'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const profiles = profilesResult.data || [];
      const products = productsResult.data || [];
      const orders = ordersResult.data || [];

      const totalCustomers = profiles.filter((p) => p.role === 'customer').length;
      const totalVendors = profiles.filter((p) => p.role === 'vendor').length;
      const activeProducts = products.filter((p) => p.is_available).length;
      const pendingOrders = orders.filter(
        (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
      ).length;

      const platformRevenue = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      setStats({
        totalUsers: profiles.length,
        totalCustomers,
        totalVendors,
        totalProducts: products.length,
        totalOrders: orders.length,
        platformRevenue,
        pendingOrders,
        activeProducts,
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const quickActions = [
    { icon: Users, label: 'Users', screen: 'users', color: '#ff8c00' },
    { icon: Store, label: 'Vendors', screen: 'vendors', color: '#f59e0b' },
    { icon: Package, label: 'Products', screen: 'products', color: '#10b981' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerBadge}>
          <Shield size={14} color="#ff8c00" />
          <Text style={styles.headerBadgeText}>Admin</Text>
        </View>
        <Text style={styles.greeting}>
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.subtitle}>Here is your platform overview</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View style={styles.revenueIconWrap}>
              <DollarSign size={22} color="#ffffff" />
            </View>
            <View style={styles.revenueBadge}>
              <BarChart3 size={12} color="#ff8c00" />
              <Text style={styles.revenueBadgeText}>Revenue</Text>
            </View>
          </View>
          <Text style={styles.revenueLabel}>Platform Revenue</Text>
          <Text style={styles.revenueValue}>
            {'\u20A6'}{stats.platformRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fff7ed' }]}>
              <Users size={20} color="#ff8c00" />
            </View>
            <Text style={styles.statValue}>{stats.totalUsers.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fef3c7' }]}>
              <Store size={20} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{stats.totalVendors.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Vendors</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#ecfdf5' }]}>
              <Package size={20} color="#10b981" />
            </View>
            <Text style={styles.statValue}>{stats.activeProducts.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Active Products</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fef2f2' }]}>
              <ShoppingBag size={20} color="#ef4444" />
            </View>
            <Text style={styles.statValue}>{stats.pendingOrders.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Pending Orders</Text>
          </View>
        </View>

        <View style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>Platform Insights</Text>
          <InsightRow
            icon={TrendingUp}
            label="Total Orders"
            value={stats.totalOrders.toLocaleString()}
          />
          <InsightRow
            icon={Users}
            label="Customer Base"
            value={stats.totalCustomers.toLocaleString()}
          />
          <InsightRow
            icon={Package}
            label="Total Products"
            value={stats.totalProducts.toLocaleString()}
            last
          />
        </View>

        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={action.screen}
                  style={styles.quickActionCard}
                  onPress={() => router.push(`/(marketplace)/admin?screen=${action.screen}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: action.color + '14' }]}>
                    <Icon size={22} color={action.color} />
                  </View>
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                  <ArrowUpRight size={14} color="#c4c9d4" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

function InsightRow({
  icon: Icon,
  label,
  value,
  last,
}: {
  icon: any;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[insightStyles.row, !last && insightStyles.rowBorder]}>
      <View style={insightStyles.iconWrap}>
        <Icon size={18} color="#ff8c00" />
      </View>
      <Text style={insightStyles.label}>{label}</Text>
      <Text style={insightStyles.value}>{value}</Text>
    </View>
  );
}

const insightStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f1f3',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontFamily: Fonts.groteskBold,
    fontSize: 18,
    color: '#1a1d23',
  },
});

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
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 14,
  },
  headerBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 12,
    color: '#ff8c00',
    letterSpacing: 0.5,
  },
  greeting: {
    fontSize: 28,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  content: {
    padding: 20,
    marginTop: -4,
  },
  revenueCard: {
    backgroundColor: '#ff8c00',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  revenueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  revenueIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  revenueBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 11,
    color: '#ff8c00',
    letterSpacing: 0.3,
  },
  revenueLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  revenueValue: {
    fontFamily: Fonts.groteskBold,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontFamily: Fonts.groteskBold,
    fontSize: 26,
    color: '#1a1d23',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
  },
  insightsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#1a1d23',
    marginBottom: 8,
  },
  quickActionsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 8,
    gap: 8,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1d23',
  },
});
