import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Package, Users, Bike, TrendingUp, DollarSign, Activity, CheckCircle, Zap } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';

type Stats = {
  totalOrders: number;
  totalCustomers: number;
  totalRiders: number;
  onlineRiders: number;
  activeDeliveries: number;
  totalRevenue: number;
  deliveredOrders: number;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalCustomers: 0,
    totalRiders: 0,
    onlineRiders: 0,
    activeDeliveries: 0,
    totalRevenue: 0,
    deliveredOrders: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();

    const channel = supabase
      .channel('admin-dashboard-riders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, () => {
        loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStats = async () => {
    try {
      const [ordersRes, customersRes, ridersRes, onlineRidersRes] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('profiles').select('id').eq('role', 'customer'),
        supabase.from('profiles').select('id').eq('role', 'rider'),
        supabase.from('riders').select('id').eq('status', 'online'),
      ]);

      const orders = ordersRes.data || [];
      const activeDeliveries = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
      const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
      const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.delivery_fee), 0);

      setStats({
        totalOrders: orders.length,
        totalCustomers: customersRes.data?.length || 0,
        totalRiders: ridersRes.data?.length || 0,
        onlineRiders: onlineRidersRes.data?.length || 0,
        activeDeliveries,
        totalRevenue,
        deliveredOrders,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const completionRate = stats.totalOrders > 0
    ? ((stats.deliveredOrders / stats.totalOrders) * 100).toFixed(1)
    : '0';

  const avgFee = stats.deliveredOrders > 0
    ? (stats.totalRevenue / stats.deliveredOrders).toFixed(0)
    : '0';

  const ordersPerRider = stats.totalRiders > 0
    ? (stats.totalOrders / stats.totalRiders).toFixed(1)
    : '0';

  const activeRatio = stats.totalOrders > 0
    ? ((stats.activeDeliveries / stats.totalOrders) * 100).toFixed(1)
    : '0';

  const formatRevenue = (value: number) => {
    if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₦${(value / 1000).toFixed(1)}K`;
    return `₦${value.toFixed(0)}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSub}>Operations overview</Text>
          </View>
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadStats(); }}
              tintColor="#f97316"
            />
          }>

          {/* Hero revenue card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <DollarSign size={22} color="#fff" />
              </View>
              <Text style={styles.heroLabel}>Total Revenue</Text>
            </View>
            <Text style={styles.heroValue}>{formatRevenue(stats.totalRevenue)}</Text>
            <View style={styles.heroFooter}>
              <View style={styles.heroChip}>
                <CheckCircle size={13} color="#fff" />
                <Text style={styles.heroChipText}>{stats.deliveredOrders} deliveries completed</Text>
              </View>
              <View style={styles.heroRateChip}>
                <TrendingUp size={13} color="#fde68a" />
                <Text style={styles.heroRateText}>{completionRate}% rate</Text>
              </View>
            </View>
          </View>

          {/* 4-card grid */}
          <View style={styles.grid}>
            <View style={[styles.gridCard, styles.gridCardOrange]}>
              <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                <Package size={20} color="#f97316" />
              </View>
              <Text style={styles.gridNumber}>{stats.totalOrders}</Text>
              <Text style={styles.gridLabel}>Total Orders</Text>
            </View>

            <View style={[styles.gridCard, styles.gridCardAmber]}>
              <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Zap size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.gridNumber, { color: '#f59e0b' }]}>{stats.activeDeliveries}</Text>
              <Text style={styles.gridLabel}>Active</Text>
            </View>

            <View style={[styles.gridCard, styles.gridCardBlue]}>
              <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Users size={20} color="#3b82f6" />
              </View>
              <Text style={[styles.gridNumber, { color: '#3b82f6' }]}>{stats.totalCustomers}</Text>
              <Text style={styles.gridLabel}>Customers</Text>
            </View>

            <View style={[styles.gridCard, styles.gridCardGreen]}>
              <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Activity size={20} color="#10b981" />
              </View>
              <Text style={[styles.gridNumber, { color: '#10b981' }]}>{stats.deliveredOrders}</Text>
              <Text style={styles.gridLabel}>Delivered</Text>
            </View>
          </View>

          {/* Riders panel */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Riders Overview</Text>
          </View>

          <View style={styles.ridersCard}>
            <View style={styles.ridersTop}>
              <View style={styles.ridersLeft}>
                <View style={styles.ridersBikeWrap}>
                  <Bike size={26} color="#f97316" />
                </View>
                <View>
                  <Text style={styles.ridersTotalNum}>{stats.totalRiders}</Text>
                  <Text style={styles.ridersTotalLabel}>Total Riders</Text>
                </View>
              </View>
              <View style={styles.ridersSplit}>
                <View style={styles.ridersStat}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.ridersStatNum}>{stats.onlineRiders}</Text>
                  <Text style={styles.ridersStatLabel}>Online</Text>
                </View>
                <View style={styles.ridersDividerV} />
                <View style={styles.ridersStat}>
                  <View style={styles.offlineDot} />
                  <Text style={styles.ridersStatNum}>{stats.totalRiders - stats.onlineRiders}</Text>
                  <Text style={styles.ridersStatLabel}>Offline</Text>
                </View>
              </View>
            </View>

            {stats.totalRiders > 0 && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round((stats.onlineRiders / stats.totalRiders) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {Math.round((stats.onlineRiders / stats.totalRiders) * 100)}% online
                </Text>
              </View>
            )}
          </View>

          {/* Performance metrics */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance Metrics</Text>
          </View>

          <View style={styles.metricsCard}>
            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: '#fff7ed' }]}>
                <DollarSign size={18} color="#f97316" />
              </View>
              <View style={styles.metricBody}>
                <Text style={styles.metricLabel}>Avg. Delivery Fee</Text>
                <Text style={styles.metricValue}>₦{avgFee}</Text>
              </View>
              <View style={[styles.metricAccent, { backgroundColor: '#fff7ed' }]}>
                <Text style={[styles.metricAccentText, { color: '#f97316' }]}>per order</Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: '#eff6ff' }]}>
                <Bike size={18} color="#3b82f6" />
              </View>
              <View style={styles.metricBody}>
                <Text style={styles.metricLabel}>Orders Per Rider</Text>
                <Text style={[styles.metricValue, { color: '#3b82f6' }]}>{ordersPerRider}</Text>
              </View>
              <View style={[styles.metricAccent, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.metricAccentText, { color: '#3b82f6' }]}>avg</Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: '#f0fdf4' }]}>
                <Activity size={18} color="#10b981" />
              </View>
              <View style={styles.metricBody}>
                <Text style={styles.metricLabel}>Active Orders Ratio</Text>
                <Text style={[styles.metricValue, { color: '#10b981' }]}>{activeRatio}%</Text>
              </View>
              <View style={[styles.metricAccent, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.metricAccentText, { color: '#10b981' }]}>of total</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#1a1a2e',
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.55)',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  liveText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#f97316',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },

  /* Hero card */
  heroCard: {
    backgroundColor: '#f97316',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  heroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  heroValue: {
    fontSize: 44,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 16,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroChipText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  heroRateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroRateText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#fde68a',
  },

  /* 4-card grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: '47.5%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gridCardOrange: {
    borderTopWidth: 3,
    borderTopColor: '#f97316',
  },
  gridCardAmber: {
    borderTopWidth: 3,
    borderTopColor: '#f59e0b',
  },
  gridCardBlue: {
    borderTopWidth: 3,
    borderTopColor: '#3b82f6',
  },
  gridCardGreen: {
    borderTopWidth: 3,
    borderTopColor: '#10b981',
  },
  gridIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridNumber: {
    fontSize: 30,
    fontFamily: Fonts.bold,
    color: '#f97316',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Section header */
  sectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
  },

  /* Riders card */
  ridersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  ridersTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ridersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ridersBikeWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ridersTotalNum: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  ridersTotalLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
  },
  ridersSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
  },
  ridersStat: {
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
  ridersStatNum: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  ridersStatLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
  },
  ridersDividerV: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#10b981',
    minWidth: 56,
    textAlign: 'right',
  },

  /* Metrics card */
  metricsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  metricDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 14,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricBody: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  metricValue: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#f97316',
  },
  metricAccent: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metricAccentText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
});
