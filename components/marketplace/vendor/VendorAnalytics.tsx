import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Rect, Path, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { TrendingUp, ShoppingBag, DollarSign, Star, ChevronDown, Package } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - 64, 560);
const CHART_HEIGHT = 160;
const BAR_CHART_HEIGHT = 130;

type Range = '7d' | '30d' | '90d';

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalReviews: number;
  avgRating: number;
  statusBreakdown: Record<string, number>;
}

export default function VendorAnalytics() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [range, setRange] = useState<Range>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile, range]);

  const getDaysBack = () => ({ '7d': 7, '30d': 30, '90d': 90 }[range]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const daysBack = getDaysBack();
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      const sinceStr = since.toISOString();

      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, subtotal, status, created_at, delivered_at')
        .eq('vendor_user_id', profile.id)
        .eq('order_source', 'marketplace')
        .gte('created_at', sinceStr);

      const orderList = orders || [];

      const totalRevenue = orderList
        .filter(o => o.status === 'delivered')
        .reduce((s: number, o: any) => s + (o.total || 0), 0);
      const totalOrders = orderList.length;
      const deliveredOrders = orderList.filter((o: any) => o.status === 'delivered');
      const avgOrderValue = deliveredOrders.length ? totalRevenue / deliveredOrders.length : 0;

      const statusBreakdown: Record<string, number> = {};
      orderList.forEach((o: any) => {
        statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
      });

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating, product_id')
        .in(
          'product_id',
          await getVendorProductIds(profile.id)
        );

      const reviews = reviewsData || [];
      const avgRating = reviews.length
        ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length
        : 0;

      setStats({ totalRevenue, totalOrders, avgOrderValue, totalReviews: reviews.length, avgRating, statusBreakdown });

      const dailyMap: Record<string, DailyRevenue> = {};
      for (let i = 0; i < daysBack; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = { date: key, revenue: 0, orders: 0 };
      }
      orderList.forEach((o: any) => {
        const key = o.created_at.slice(0, 10);
        if (dailyMap[key]) {
          dailyMap[key].orders += 1;
          if (o.status === 'delivered') dailyMap[key].revenue += o.total || 0;
        }
      });
      const sorted = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      setDailyRevenue(sorted);

      const orderIds = orderList.map((o: any) => o.id);
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, quantity, subtotal, products(name)')
          .in('order_id', orderIds);

        const productMap: Record<string, TopProduct> = {};
        (items || []).forEach((item: any) => {
          const id = item.product_id;
          const name = item.products?.name || 'Unknown';
          if (!productMap[id]) productMap[id] = { name, quantity: 0, revenue: 0 };
          productMap[id].quantity += item.quantity || 0;
          productMap[id].revenue += item.subtotal || 0;
        });
        const sorted = Object.values(productMap)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);
        setTopProducts(sorted);
      }
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVendorProductIds = async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('vendor_id', userId);
    return (data || []).map((p: any) => p.id);
  };

  const formatCurrency = (val: number) =>
    val >= 1000000 ? `₦${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `₦${(val / 1000).toFixed(1)}K` : `₦${val.toFixed(0)}`;

  const renderLineChart = () => {
    if (!dailyRevenue.length) return null;
    const maxVal = Math.max(...dailyRevenue.map(d => d.revenue), 1);
    const pts = dailyRevenue.map((d, i) => {
      const x = (i / (dailyRevenue.length - 1)) * (CHART_WIDTH - 40) + 20;
      const y = CHART_HEIGHT - 20 - ((d.revenue / maxVal) * (CHART_HEIGHT - 40));
      return { x, y, ...d };
    });

    const pathD = pts
      .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
      .join(' ');

    const areaD = `${pathD} L${pts[pts.length - 1].x},${CHART_HEIGHT - 20} L${pts[0].x},${CHART_HEIGHT - 20} Z`;

    const step = Math.max(1, Math.floor(dailyRevenue.length / 5));
    const labelPts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

    return (
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Path d={areaD} fill={colors.primary + '18'} />
        <Path d={pathD} stroke={colors.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r="3" fill={colors.primary} />
        ))}
        {labelPts.map((p, i) => (
          <SvgText key={i} x={p.x} y={CHART_HEIGHT - 4} fontSize="9" fill={colors.textMuted} textAnchor="middle">
            {p.date.slice(5)}
          </SvgText>
        ))}
        <SvgText x={4} y={18} fontSize="9" fill={colors.textMuted}>{formatCurrency(maxVal)}</SvgText>
        <SvgText x={4} y={CHART_HEIGHT - 24} fontSize="9" fill={colors.textMuted}>₦0</SvgText>
      </Svg>
    );
  };

  const renderBarChart = () => {
    if (!topProducts.length) return null;
    const maxQ = Math.max(...topProducts.map(p => p.quantity), 1);
    const barWidth = (CHART_WIDTH - 40) / topProducts.length - 12;

    return (
      <Svg width={CHART_WIDTH} height={BAR_CHART_HEIGHT + 24}>
        {topProducts.map((p, i) => {
          const barH = Math.max(4, (p.quantity / maxQ) * BAR_CHART_HEIGHT);
          const x = 20 + i * ((CHART_WIDTH - 40) / topProducts.length) + 6;
          const y = BAR_CHART_HEIGHT - barH;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                fill={colors.primary}
                opacity={0.7 + (i === 0 ? 0.3 : 0)}
              />
              <SvgText
                x={x + barWidth / 2}
                y={BAR_CHART_HEIGHT + 14}
                fontSize="8"
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name}
              </SvgText>
              <SvgText
                x={x + barWidth / 2}
                y={y - 4}
                fontSize="9"
                fill={colors.text}
                textAnchor="middle"
              >
                {p.quantity}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const statCards = [
    { label: 'Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: DollarSign, color: '#059669' },
    { label: 'Orders', value: `${stats?.totalOrders || 0}`, icon: ShoppingBag, color: colors.primary },
    { label: 'Avg Order', value: formatCurrency(stats?.avgOrderValue || 0), icon: TrendingUp, color: '#3b82f6' },
    { label: 'Avg Rating', value: stats?.avgRating ? stats.avgRating.toFixed(1) : '—', icon: Star, color: '#f59e0b' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.rangeRow}>
        {(['7d', '30d', '90d'] as Range[]).map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeBtn, { borderColor: colors.border, backgroundColor: range === r ? colors.primary : colors.surface }]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeBtnText, { color: range === r ? '#fff' : colors.textSecondary }]}>
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsGrid}>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: card.color + '18' }]}>
                <Icon size={18} color={card.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{card.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{card.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Revenue Over Time</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderLineChart()}
        </ScrollView>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Top Products (by units sold)</Text>
        {topProducts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderBarChart()}
          </ScrollView>
        ) : (
          <Text style={[styles.noData, { color: colors.textMuted }]}>No sales data yet</Text>
        )}
      </View>

      {stats?.statusBreakdown && Object.keys(stats.statusBreakdown).length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Order Status Breakdown</Text>
          {Object.entries(stats.statusBreakdown).map(([status, count]) => {
            const total = Object.values(stats.statusBreakdown).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? (count / total) * 100 : 0;
            const statusColor: Record<string, string> = {
              pending: '#f59e0b', confirmed: '#3b82f6', preparing: colors.primary,
              out_for_delivery: '#f97316', delivered: '#059669', cancelled: '#ef4444',
            };
            const color = statusColor[status] || colors.textSecondary;
            return (
              <View key={status} style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                  {status.replace(/_/g, ' ')}
                </Text>
                <View style={styles.statusBarWrap}>
                  <View style={[styles.statusBar, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.statusCount, { color: colors.text }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rangeBtn: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center',
  },
  rangeBtnText: { fontSize: 13, fontFamily: Fonts.spaceSemiBold },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 22, fontFamily: Fonts.spaceBold },
  statLabel: { fontSize: 12, fontFamily: Fonts.spaceRegular },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardTitle: { fontSize: 15, fontFamily: Fonts.spaceSemiBold, marginBottom: 14 },
  noData: { fontSize: 13, fontFamily: Fonts.spaceRegular, textAlign: 'center', paddingVertical: 24 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  statusLabel: { width: 110, fontSize: 12, fontFamily: Fonts.spaceRegular, textTransform: 'capitalize' },
  statusBarWrap: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  statusBar: { height: 8, borderRadius: 4, minWidth: 4 },
  statusCount: { width: 32, textAlign: 'right', fontSize: 13, fontFamily: Fonts.spaceSemiBold },
});
