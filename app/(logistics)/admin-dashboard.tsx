import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Package, Users, Bike, TrendingUp, DollarSign, Activity, CheckCircle, Zap, Star, Search, X, ChevronDown, MessageSquare, User, Trash2, Filter } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Stats = {
  totalOrders: number;
  totalCustomers: number;
  totalRiders: number;
  onlineRiders: number;
  activeDeliveries: number;
  totalRevenue: number;
  deliveredOrders: number;
};

type Rating = {
  id: string;
  order_id: string;
  rider_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rider_name: string;
  customer_name: string;
  order_ref: string;
};

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type FilterOption = 'all' | '5' | '4' | '3' | '2' | '1';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest First',
  oldest: 'Oldest First',
  highest: 'Highest Rating',
  lowest: 'Lowest Rating',
};

type ActiveTab = 'overview' | 'reviews';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

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

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStar, setFilterStar] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [ratingStats, setRatingStats] = useState({ total: 0, average: 0, star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 });

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ visible: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    loadStats();
    const channel = supabase
      .channel('admin-dashboard-riders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, () => { loadStats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === 'reviews' && ratings.length === 0) {
      loadRatings();
    }
  }, [activeTab]);

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
      const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, order) => sum + parseFloat(order.delivery_fee), 0);
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

  const loadRatings = useCallback(async () => {
    setRatingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('id, order_id, rider_id, customer_id, rating, comment, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        setRatings([]);
        setRatingStats({ total: 0, average: 0, star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 });
        return;
      }
      const enriched: Rating[] = await Promise.all(
        data.map(async (r) => {
          let riderName = 'Unknown Rider';
          let customerName = 'Unknown Customer';
          const orderRef = r.order_id.slice(0, 8).toUpperCase();
          const [riderRes, customerRes] = await Promise.all([
            supabase.from('riders').select('user_id').eq('id', r.rider_id).maybeSingle(),
            supabase.from('profiles').select('full_name').eq('id', r.customer_id).maybeSingle(),
          ]);
          if (riderRes.data?.user_id) {
            const { data: rp } = await supabase.from('profiles').select('full_name').eq('id', riderRes.data.user_id).maybeSingle();
            if (rp?.full_name) riderName = rp.full_name;
          }
          if (customerRes.data?.full_name) customerName = customerRes.data.full_name;
          return { ...r, rider_name: riderName, customer_name: customerName, order_ref: orderRef };
        })
      );
      setRatings(enriched);
      const total = enriched.length;
      const avg = total > 0 ? enriched.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      setRatingStats({
        total,
        average: Math.round(avg * 10) / 10,
        star5: enriched.filter(r => r.rating === 5).length,
        star4: enriched.filter(r => r.rating === 4).length,
        star3: enriched.filter(r => r.rating === 3).length,
        star2: enriched.filter(r => r.rating === 2).length,
        star1: enriched.filter(r => r.rating === 1).length,
      });
    } catch (err) {
      showToast('Failed to load reviews', 'error');
    } finally {
      setRatingsLoading(false);
    }
  }, []);

  const handleDelete = (rating: Rating) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Review',
      message: `Delete this ${rating.rating}-star review by ${rating.customer_name}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('ratings').delete().eq('id', rating.id);
          if (error) throw error;
          showToast('Review deleted successfully', 'success');
          setDetailModalVisible(false);
          loadRatings();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete review', 'error');
        }
      },
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
    if (activeTab === 'reviews') loadRatings();
  };

  const completionRate = stats.totalOrders > 0 ? ((stats.deliveredOrders / stats.totalOrders) * 100).toFixed(1) : '0';
  const avgFee = stats.deliveredOrders > 0 ? (stats.totalRevenue / stats.deliveredOrders).toFixed(0) : '0';
  const ordersPerRider = stats.totalRiders > 0 ? (stats.totalOrders / stats.totalRiders).toFixed(1) : '0';
  const activeRatio = stats.totalOrders > 0 ? ((stats.activeDeliveries / stats.totalOrders) * 100).toFixed(1) : '0';

  const formatRevenue = (value: number) => {
    if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₦${(value / 1000).toFixed(1)}K`;
    return `₦${value.toFixed(0)}`;
  };

  const filteredRatings = ratings
    .filter(r => {
      if (filterStar !== 'all' && r.rating !== parseInt(filterStar)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.rider_name.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q) || r.order_ref.toLowerCase().includes(q) || (r.comment?.toLowerCase().includes(q) ?? false);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return 0;
    });

  const renderStars = (count: number, size = 16, color = '#f59e0b') => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} color={i <= count ? color : '#d1d5db'} fill={i <= count ? color : 'transparent'} />
      ))}
    </View>
  );

  const getRatingLabel = (r: number) => ({ 5: 'Excellent', 4: 'Good', 3: 'Average', 2: 'Below Average', 1: 'Poor' }[r] || '');
  const getRatingColor = (r: number) => r >= 4 ? '#10b981' : r === 3 ? '#f59e0b' : '#ef4444';
  const barWidth = (count: number) => ratingStats.total > 0 ? Math.max((count / ratingStats.total) * 100, 2) : 0;

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

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.8}
          >
            <Activity size={16} color={activeTab === 'overview' ? '#f97316' : '#6b7280'} />
            <Text style={[styles.tabLabel, activeTab === 'overview' && styles.tabLabelActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'reviews' && styles.tabItemActive]}
            onPress={() => setActiveTab('reviews')}
            activeOpacity={0.8}
          >
            <Star size={16} color={activeTab === 'reviews' ? '#f97316' : '#6b7280'} fill={activeTab === 'reviews' ? '#f97316' : 'transparent'} />
            <Text style={[styles.tabLabel, activeTab === 'reviews' && styles.tabLabelActive]}>Reviews</Text>
            {ratingStats.total > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{ratingStats.total}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
            }
          >
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
                    <View style={[styles.progressFill, { width: `${Math.round((stats.onlineRiders / stats.totalRiders) * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{Math.round((stats.onlineRiders / stats.totalRiders) * 100)}% online</Text>
                </View>
              )}
            </View>

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
        ) : (
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
          >
            {ratingStats.total > 0 && (
              <View style={styles.statsCard}>
                <View style={styles.statsLeft}>
                  <Text style={styles.avgScore}>{ratingStats.average.toFixed(1)}</Text>
                  <View style={styles.avgStars}>{renderStars(Math.round(ratingStats.average), 20)}</View>
                  <Text style={styles.avgLabel}>{ratingStats.total} review{ratingStats.total !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.statsRight}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = ratingStats[`star${star}` as keyof typeof ratingStats] as number;
                    return (
                      <TouchableOpacity
                        key={star}
                        style={styles.barRow}
                        onPress={() => setFilterStar(filterStar === String(star) as FilterOption ? 'all' : String(star) as FilterOption)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.barLabel}>{star}</Text>
                        <Star size={10} color="#f59e0b" fill="#f59e0b" />
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${barWidth(count)}%` as any, backgroundColor: filterStar === String(star) ? '#f59e0b' : '#fcd34d' }]} />
                        </View>
                        <Text style={styles.barCount}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.controls}>
              <View style={styles.searchBox}>
                <Search size={16} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search rider, customer, order..."
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={14} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.sortButton} onPress={() => setSortModalVisible(true)}>
                <Filter size={14} color="#374151" />
                <ChevronDown size={14} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
              {(['all', '5', '4', '3', '2', '1'] as FilterOption[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, filterStar === f && styles.filterChipActive]}
                  onPress={() => setFilterStar(f)}
                >
                  {f !== 'all' && <Star size={11} color={filterStar === f ? '#ffffff' : '#f59e0b'} fill={filterStar === f ? '#ffffff' : '#f59e0b'} />}
                  <Text style={[styles.filterChipText, filterStar === f && styles.filterChipTextActive]}>
                    {f === 'all' ? 'All' : `${f} Star`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {ratingsLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Loading reviews...</Text>
              </View>
            ) : filteredRatings.length === 0 ? (
              <View style={styles.emptyState}>
                <Star size={48} color="#e5e7eb" />
                <Text style={styles.emptyTitle}>{ratings.length === 0 ? 'No Reviews Yet' : 'No Results Found'}</Text>
                <Text style={styles.emptySubtitle}>
                  {ratings.length === 0 ? 'Reviews will appear here after customers rate their deliveries' : 'Try adjusting your search or filter'}
                </Text>
              </View>
            ) : (
              <View style={styles.listContainer}>
                {filteredRatings.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.reviewCard}
                    onPress={() => { setSelectedRating(item); setDetailModalVisible(true); }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.reviewCardTop}>
                      <View style={styles.reviewMeta}>
                        {renderStars(item.rating, 14)}
                        <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(item.rating) + '20' }]}>
                          <Text style={[styles.ratingBadgeText, { color: getRatingColor(item.rating) }]}>{getRatingLabel(item.rating)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(item); }} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    {item.comment ? (
                      <Text style={styles.reviewComment} numberOfLines={2}>"{item.comment}"</Text>
                    ) : (
                      <Text style={styles.noComment}>No comment left</Text>
                    )}
                    <View style={styles.reviewFooter}>
                      <View style={styles.reviewPerson}>
                        <User size={12} color="#6b7280" />
                        <Text style={styles.reviewPersonText}>{item.customer_name}</Text>
                      </View>
                      <View style={styles.reviewDivider} />
                      <View style={styles.reviewPerson}>
                        <Bike size={12} color="#6b7280" />
                        <Text style={styles.reviewPersonText}>{item.rider_name}</Text>
                      </View>
                      <View style={styles.reviewDivider} />
                      <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>

      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity style={styles.sortOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>Sort Reviews</Text>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
              <TouchableOpacity key={opt} style={[styles.sortOption, sortBy === opt && styles.sortOptionActive]} onPress={() => { setSortBy(opt); setSortModalVisible(false); }}>
                <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>{SORT_LABELS[opt]}</Text>
                {sortBy === opt && <View style={styles.sortCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Review Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <X size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {selectedRating && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.detailBody}>
                <View style={styles.detailRatingRow}>
                  {renderStars(selectedRating.rating, 28)}
                  <Text style={[styles.detailRatingNum, { color: getRatingColor(selectedRating.rating) }]}>{selectedRating.rating}.0</Text>
                  <Text style={[styles.detailRatingLabel, { color: getRatingColor(selectedRating.rating) }]}>{getRatingLabel(selectedRating.rating)}</Text>
                </View>
                {selectedRating.comment ? (
                  <View style={styles.detailCommentBox}>
                    <MessageSquare size={16} color="#6b7280" />
                    <Text style={styles.detailComment}>"{selectedRating.comment}"</Text>
                  </View>
                ) : (
                  <Text style={styles.noComment}>No comment was left for this review.</Text>
                )}
                <View style={styles.detailInfoGrid}>
                  <View style={styles.detailInfoItem}>
                    <View style={styles.detailInfoIcon}><User size={16} color="#3b82f6" /></View>
                    <View>
                      <Text style={styles.detailInfoLabel}>Customer</Text>
                      <Text style={styles.detailInfoValue}>{selectedRating.customer_name}</Text>
                    </View>
                  </View>
                  <View style={styles.detailInfoItem}>
                    <View style={[styles.detailInfoIcon, { backgroundColor: '#fef3c7' }]}><Bike size={16} color="#f59e0b" /></View>
                    <View>
                      <Text style={styles.detailInfoLabel}>Rider</Text>
                      <Text style={styles.detailInfoValue}>{selectedRating.rider_name}</Text>
                    </View>
                  </View>
                  <View style={styles.detailInfoItem}>
                    <View style={[styles.detailInfoIcon, { backgroundColor: '#f0fdf4' }]}><Package size={16} color="#10b981" /></View>
                    <View>
                      <Text style={styles.detailInfoLabel}>Order</Text>
                      <Text style={styles.detailInfoValue}>#{selectedRating.order_ref}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.detailDate}>
                  Submitted on {new Date(selectedRating.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity style={styles.deleteFullBtn} onPress={() => handleDelete(selectedRating)}>
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.deleteFullBtnText}>Delete Review</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} duration={3000} onDismiss={() => setToast({ ...toast, visible: false })} />
      <ConfirmDialog visible={confirmDialog.visible} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#1a1a2e',
  },
  headerLeft: { gap: 2 },
  headerTitle: { fontSize: 26, fontFamily: Fonts.bold, color: '#ffffff', letterSpacing: 0.3 },
  headerSub: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.55)' },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.18)', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f97316' },
  liveText: { fontSize: 12, fontFamily: Fonts.bold, color: '#f97316', letterSpacing: 0.5 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#f97316' },
  tabLabel: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#6b7280' },
  tabLabelActive: { color: '#f97316' },
  tabBadge: {
    backgroundColor: '#fef3c7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  tabBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#92400e' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },

  heroCard: {
    backgroundColor: '#f97316', borderRadius: 24, padding: 24, marginBottom: 20,
    shadowColor: '#f97316', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 15, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.85)' },
  heroValue: { fontSize: 44, fontFamily: Fonts.bold, color: '#ffffff', letterSpacing: -1, marginBottom: 16 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  heroChipText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#ffffff' },
  heroRateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  heroRateText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fde68a' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  gridCard: { width: '47.5%', backgroundColor: '#ffffff', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  gridCardOrange: { borderTopWidth: 3, borderTopColor: '#f97316' },
  gridCardAmber: { borderTopWidth: 3, borderTopColor: '#f59e0b' },
  gridCardBlue: { borderTopWidth: 3, borderTopColor: '#3b82f6' },
  gridCardGreen: { borderTopWidth: 3, borderTopColor: '#10b981' },
  gridIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridNumber: { fontSize: 30, fontFamily: Fonts.bold, color: '#f97316', letterSpacing: -0.5, marginBottom: 4 },
  gridLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionHeader: { marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#111827' },

  ridersCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  ridersTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  ridersLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ridersBikeWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  ridersTotalNum: { fontSize: 28, fontFamily: Fonts.bold, color: '#111827' },
  ridersTotalLabel: { fontSize: 13, fontFamily: Fonts.regular, color: '#9ca3af' },
  ridersSplit: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  ridersStat: { alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  offlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  ridersStatNum: { fontSize: 18, fontFamily: Fonts.bold, color: '#111827' },
  ridersStatLabel: { fontSize: 11, fontFamily: Fonts.regular, color: '#9ca3af' },
  ridersDividerV: { width: 1, height: 32, backgroundColor: '#e5e7eb' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 7, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progressLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#10b981', minWidth: 56, textAlign: 'right' },

  metricsCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  metricItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  metricDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },
  metricIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricBody: { flex: 1, gap: 2 },
  metricLabel: { fontSize: 13, fontFamily: Fonts.regular, color: '#6b7280' },
  metricValue: { fontSize: 20, fontFamily: Fonts.bold, color: '#f97316' },
  metricAccent: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  metricAccentText: { fontSize: 11, fontFamily: Fonts.semiBold },

  statsCard: { margin: 16, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, flexDirection: 'row', gap: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statsLeft: { alignItems: 'center', justifyContent: 'center', width: 80 },
  avgScore: { fontSize: 44, fontFamily: Fonts.bold, color: '#111827', lineHeight: 52 },
  avgStars: { marginTop: 4 },
  avgLabel: { fontSize: 12, color: '#9ca3af', fontFamily: Fonts.regular, marginTop: 6, textAlign: 'center' },
  statsRight: { flex: 1, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#374151', width: 10, textAlign: 'right' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontSize: 12, fontFamily: Fonts.regular, color: '#6b7280', width: 20, textAlign: 'right' },

  controls: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontFamily: Fonts.regular, outlineStyle: 'none' } as any,
  sortButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  filterRow: { marginBottom: 12 },
  filterRowContent: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  filterChipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#374151' },
  filterChipTextActive: { color: '#ffffff' },

  emptyState: { alignItems: 'center', paddingVertical: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: '#374151' },
  emptyText: { fontSize: 15, color: '#6b7280', fontFamily: Fonts.regular },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20 },

  listContainer: { paddingHorizontal: 16, gap: 10 },
  reviewCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  reviewCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ratingBadgeText: { fontSize: 11, fontFamily: Fonts.bold },
  deleteBtn: { padding: 4 },
  reviewComment: { fontSize: 14, color: '#374151', fontFamily: Fonts.regular, lineHeight: 20, marginBottom: 12, fontStyle: 'italic' },
  noComment: { fontSize: 13, color: '#9ca3af', fontFamily: Fonts.regular, marginBottom: 12, fontStyle: 'italic' },
  reviewFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reviewPerson: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewPersonText: { fontSize: 12, color: '#6b7280', fontFamily: Fonts.semiBold },
  reviewDivider: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#d1d5db' },
  reviewDate: { fontSize: 12, color: '#9ca3af', fontFamily: Fonts.regular },

  sortOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sortSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 4 },
  sortTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#111827', marginBottom: 12 },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10 },
  sortOptionActive: { backgroundColor: '#fef3c7' },
  sortOptionText: { fontSize: 15, fontFamily: Fonts.regular, color: '#374151' },
  sortOptionTextActive: { fontFamily: Fonts.bold, color: '#92400e' },
  sortCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },

  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 32 },
  detailHandle: { width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailTitle: { fontSize: 18, fontFamily: Fonts.bold, color: '#111827' },
  detailBody: { paddingHorizontal: 24, paddingTop: 20 },
  detailRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  detailRatingNum: { fontSize: 24, fontFamily: Fonts.bold },
  detailRatingLabel: { fontSize: 16, fontFamily: Fonts.semiBold },
  detailCommentBox: { flexDirection: 'row', gap: 10, backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  detailComment: { flex: 1, fontSize: 15, color: '#374151', fontFamily: Fonts.regular, lineHeight: 22, fontStyle: 'italic' },
  detailInfoGrid: { gap: 12, marginBottom: 20 },
  detailInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f9fafb', borderRadius: 12, padding: 14 },
  detailInfoIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  detailInfoLabel: { fontSize: 12, color: '#9ca3af', fontFamily: Fonts.regular, marginBottom: 2 },
  detailInfoValue: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#111827' },
  detailDate: { fontSize: 13, color: '#9ca3af', fontFamily: Fonts.regular, textAlign: 'center', marginBottom: 24 },
  deleteFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff5f5', marginBottom: 8 },
  deleteFullBtnText: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#ef4444' },
});
