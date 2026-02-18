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
import {
  Users,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Package,
  FileText,
  Truck,
  Building2,
  Megaphone,
  Layers,
  Star,
  Scale,
  ChevronRight,
  BarChart3,
  Shield,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';
import VendorManagement from '@/components/marketplace/admin/VendorManagement';
import OrderManagement from '@/components/marketplace/admin/OrderManagement';
import UserManagement from '@/components/marketplace/admin/UserManagement';
import ProductManagement from '@/components/marketplace/admin/ProductManagement';
import ContentManagement from '@/components/marketplace/admin/ContentManagement';
import DeliveryManagement from '@/components/marketplace/admin/DeliveryManagement';
import BankAccountManagement from '@/components/marketplace/admin/BankAccountManagement';
import AdvertManagement from '@/components/marketplace/admin/AdvertManagement';
import CategoryManagement from '@/components/marketplace/admin/CategoryManagement';
import ReviewModeration from '@/components/marketplace/admin/ReviewModeration';
import WeightChargesManagement from '@/components/marketplace/admin/WeightChargesManagement';
import { useLocalSearchParams } from 'expo-router';

interface Stats {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

const MENU_ITEMS = [
  { key: 'users', icon: Users, label: 'Manage Users', desc: 'View and manage user accounts', color: '#ff8c00' },
  { key: 'vendors', icon: ShoppingBag, label: 'Manage Vendors', desc: 'Approve and manage vendors', color: '#f59e0b' },
  { key: 'products', icon: Package, label: 'Manage Products', desc: 'Review product listings', color: '#10b981' },
  { key: 'categories', icon: Layers, label: 'Manage Categories', desc: 'Organize product categories', color: '#3b82f6' },
  { key: 'orders', icon: TrendingUp, label: 'Manage Orders', desc: 'Track and manage orders', color: '#ef4444' },
  { key: 'content', icon: FileText, label: 'Manage Content', desc: 'Edit pages and FAQs', color: '#8b5cf6' },
  { key: 'delivery', icon: Truck, label: 'Delivery Management', desc: 'Zones, pricing and logs', color: '#06b6d4' },
  { key: 'bank', icon: Building2, label: 'Bank Accounts', desc: 'Payment account settings', color: '#64748b' },
  { key: 'adverts', icon: Megaphone, label: 'Advert Management', desc: 'Manage promotional adverts', color: '#ec4899' },
  { key: 'reviews', icon: Star, label: 'Review Moderation', desc: 'Moderate customer reviews', color: '#f59e0b' },
  { key: 'weight_charges', icon: Scale, label: 'Weight Charges', desc: 'Set surcharges by cart weight', color: '#0ea5e9' },
];

export default function AdminScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalVendors: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (params.screen === 'users') setActiveScreen('users');
    else if (params.screen === 'vendors') setActiveScreen('vendors');
    else if (params.screen === 'products') setActiveScreen('products');
  }, [params.screen]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [
        { count: usersCount },
        { count: vendorsCount },
        { count: productsCount },
        { count: ordersCount },
        { data: ordersData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total'),
      ]);

      const totalRevenue = (ordersData || []).reduce(
        (sum: number, order: any) => sum + Number(order.total),
        0
      );

      setStats({
        totalUsers: usersCount || 0,
        totalVendors: vendorsCount || 0,
        totalProducts: productsCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => setActiveScreen(null);

  if (activeScreen === 'users') return <UserManagement onBack={handleBack} />;
  if (activeScreen === 'vendors') return <VendorManagement onBack={handleBack} />;
  if (activeScreen === 'products') return <ProductManagement onBack={handleBack} />;
  if (activeScreen === 'orders') return <OrderManagement onBack={handleBack} />;
  if (activeScreen === 'content') return <ContentManagement onBack={handleBack} />;

  const subScreens: Record<string, { title: string; component: React.ReactNode }> = {
    delivery: { title: 'Delivery Management', component: <DeliveryManagement /> },
    bank: { title: 'Bank Accounts', component: <BankAccountManagement /> },
    adverts: { title: 'Advert Management', component: <AdvertManagement /> },
    categories: { title: 'Category Management', component: <CategoryManagement /> },
    reviews: { title: 'Review Moderation', component: <ReviewModeration /> },
    weight_charges: { title: 'Weight Charges', component: <WeightChargesManagement /> },
  };

  if (activeScreen && subScreens[activeScreen]) {
    const screen = subScreens[activeScreen];
    return (
      <View style={{ flex: 1, backgroundColor: '#f8f9fb' }}>
        <View style={[styles.subHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>{screen.title}</Text>
          <View style={{ width: 48 }} />
        </View>
        {screen.component}
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <View style={styles.headerBadge}>
          <Shield size={14} color="#ff8c00" />
          <Text style={styles.headerBadgeText}>Admin Panel</Text>
        </View>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Your platform at a glance</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View style={styles.revenueIconWrap}>
              <DollarSign size={24} color="#ffffff" />
            </View>
            <View style={styles.revenueBadge}>
              <BarChart3 size={12} color="#ff8c00" />
              <Text style={styles.revenueBadgeText}>Revenue</Text>
            </View>
          </View>
          <Text style={styles.revenueLabel}>Total Revenue</Text>
          <Text style={styles.revenueValue}>
            {'\u20A6'}{stats.totalRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fff7ed' }]}>
              <Users size={20} color="#ff8c00" />
            </View>
            <Text style={styles.statValue}>{stats.totalUsers.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fef3c7' }]}>
              <ShoppingBag size={20} color="#f59e0b" />
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
            <Text style={styles.statValue}>{stats.totalProducts.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fef2f2' }]}>
              <TrendingUp size={20} color="#ef4444" />
            </View>
            <Text style={styles.statValue}>{stats.totalOrders.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Management</Text>
          <Text style={styles.sectionCount}>{MENU_ITEMS.length} sections</Text>
        </View>

        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.menuItem,
                  index < MENU_ITEMS.length - 1 && styles.menuItemBorder,
                ]}
                onPress={() => setActiveScreen(item.key)}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: item.color + '14' }]}>
                  <Icon size={20} color={item.color} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDesc}>{item.desc}</Text>
                </View>
                <ChevronRight size={18} color="#c4c9d4" />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
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
    marginBottom: 16,
  },
  headerBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 12,
    color: '#ff8c00',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 4,
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
    width: 48,
    height: 48,
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
    fontSize: 30,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    color: '#1a1d23',
  },
  sectionCount: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f1f3',
  },
  menuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#1a1d23',
    marginBottom: 2,
  },
  menuDesc: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#8b909a',
  },
  subHeader: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    borderRadius: 8,
  },
  backBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: '#ff8c00',
  },
  subHeaderTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#ffffff',
  },
});
