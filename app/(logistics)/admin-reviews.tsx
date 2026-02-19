import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Star, Search, X, ChevronDown, MessageSquare, User, Bike, Package, Trash2, Filter } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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

export default function AdminReviews() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStar, setFilterStar] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    star5: 0,
    star4: 0,
    star3: 0,
    star2: 0,
    star1: 0,
  });

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ visible: false, message: '', type: 'success' });

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const loadRatings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          id,
          order_id,
          rider_id,
          customer_id,
          rating,
          comment,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setRatings([]);
        setStats({ total: 0, average: 0, star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 });
        return;
      }

      const enriched: Rating[] = await Promise.all(
        data.map(async (r) => {
          let riderName = 'Unknown Rider';
          let customerName = 'Unknown Customer';
          let orderRef = r.order_id.slice(0, 8).toUpperCase();

          const [riderRes, customerRes, orderRes] = await Promise.all([
            supabase
              .from('riders')
              .select('user_id')
              .eq('id', r.rider_id)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('full_name')
              .eq('id', r.customer_id)
              .maybeSingle(),
            supabase
              .from('orders')
              .select('id')
              .eq('id', r.order_id)
              .maybeSingle(),
          ]);

          if (riderRes.data?.user_id) {
            const { data: riderProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', riderRes.data.user_id)
              .maybeSingle();
            if (riderProfile?.full_name) riderName = riderProfile.full_name;
          }

          if (customerRes.data?.full_name) {
            customerName = customerRes.data.full_name;
          }

          return {
            ...r,
            rider_name: riderName,
            customer_name: customerName,
            order_ref: orderRef,
          };
        })
      );

      setRatings(enriched);

      const total = enriched.length;
      const avg = total > 0 ? enriched.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      setStats({
        total,
        average: Math.round(avg * 10) / 10,
        star5: enriched.filter(r => r.rating === 5).length,
        star4: enriched.filter(r => r.rating === 4).length,
        star3: enriched.filter(r => r.rating === 3).length,
        star2: enriched.filter(r => r.rating === 2).length,
        star1: enriched.filter(r => r.rating === 1).length,
      });
    } catch (err) {
      console.error('Error loading ratings:', err);
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') loadRatings();
  }, [profile, loadRatings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRatings();
    setRefreshing(false);
  };

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

  const filtered = ratings
    .filter(r => {
      if (filterStar !== 'all' && r.rating !== parseInt(filterStar)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.rider_name.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.order_ref.toLowerCase().includes(q) ||
          (r.comment?.toLowerCase().includes(q) ?? false)
        );
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
        <Star
          key={i}
          size={size}
          color={i <= count ? color : '#d1d5db'}
          fill={i <= count ? color : 'transparent'}
        />
      ))}
    </View>
  );

  const getRatingLabel = (r: number) => {
    const labels: Record<number, string> = { 5: 'Excellent', 4: 'Good', 3: 'Average', 2: 'Below Average', 1: 'Poor' };
    return labels[r] || '';
  };

  const getRatingColor = (r: number) => {
    if (r >= 4) return '#10b981';
    if (r === 3) return '#f59e0b';
    return '#ef4444';
  };

  const barWidth = (count: number) => stats.total > 0 ? Math.max((count / stats.total) * 100, 2) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Star size={28} color="#f59e0b" fill="#f59e0b" />
          <Text style={styles.headerTitle}>Reviews</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{stats.total}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Customer ratings for logistics deliveries</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        {stats.total > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statsLeft}>
              <Text style={styles.avgScore}>{stats.average.toFixed(1)}</Text>
              <View style={styles.avgStars}>{renderStars(Math.round(stats.average), 20)}</View>
              <Text style={styles.avgLabel}>{stats.total} review{stats.total !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.statsRight}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = stats[`star${star}` as keyof typeof stats] as number;
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

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading reviews...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Star size={48} color="#e5e7eb" />
            <Text style={styles.emptyTitle}>{ratings.length === 0 ? 'No Reviews Yet' : 'No Results Found'}</Text>
            <Text style={styles.emptySubtitle}>
              {ratings.length === 0
                ? 'Reviews will appear here after customers rate their deliveries'
                : 'Try adjusting your search or filter'}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filtered.map(item => (
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
                      <Text style={[styles.ratingBadgeText, { color: getRatingColor(item.rating) }]}>
                        {getRatingLabel(item.rating)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
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
                  <Text style={styles.reviewDate}>
                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity style={styles.sortOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>Sort Reviews</Text>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.sortOption, sortBy === opt && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt); setSortModalVisible(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>
                  {SORT_LABELS[opt]}
                </Text>
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
                  <Text style={[styles.detailRatingNum, { color: getRatingColor(selectedRating.rating) }]}>
                    {selectedRating.rating}.0
                  </Text>
                  <Text style={[styles.detailRatingLabel, { color: getRatingColor(selectedRating.rating) }]}>
                    {getRatingLabel(selectedRating.rating)}
                  </Text>
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
                    <View style={styles.detailInfoIcon}>
                      <User size={16} color="#3b82f6" />
                    </View>
                    <View>
                      <Text style={styles.detailInfoLabel}>Customer</Text>
                      <Text style={styles.detailInfoValue}>{selectedRating.customer_name}</Text>
                    </View>
                  </View>
                  <View style={styles.detailInfoItem}>
                    <View style={[styles.detailInfoIcon, { backgroundColor: '#fef3c7' }]}>
                      <Bike size={16} color="#f59e0b" />
                    </View>
                    <View>
                      <Text style={styles.detailInfoLabel}>Rider</Text>
                      <Text style={styles.detailInfoValue}>{selectedRating.rider_name}</Text>
                    </View>
                  </View>
                  <View style={styles.detailInfoItem}>
                    <View style={[styles.detailInfoIcon, { backgroundColor: '#f0fdf4' }]}>
                      <Package size={16} color="#10b981" />
                    </View>
                    <View>
                      <Text style={styles.detailInfoLabel}>Order</Text>
                      <Text style={styles.detailInfoValue}>#{selectedRating.order_ref}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.detailDate}>
                  Submitted on {new Date(selectedRating.created_at).toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </Text>

                <TouchableOpacity
                  style={styles.deleteFullBtn}
                  onPress={() => handleDelete(selectedRating)}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.deleteFullBtnText}>Delete Review</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={3000}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#111827',
    letterSpacing: -0.5,
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#92400e',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Regular',
    color: '#6b7280',
    marginTop: 3,
  },
  scroll: { flex: 1 },
  statsCard: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    gap: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statsLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  avgScore: {
    fontSize: 44,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#111827',
    lineHeight: 52,
  },
  avgStars: { marginTop: 4 },
  avgLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'SpaceGrotesk-Regular',
    marginTop: 6,
    textAlign: 'center',
  },
  statsRight: { flex: 1, gap: 6 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: '#374151',
    width: 10,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barCount: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Regular',
    color: '#6b7280',
    width: 20,
    textAlign: 'right',
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontFamily: 'SpaceGrotesk-Regular',
    outlineStyle: 'none',
  } as any,
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  filterRow: { marginBottom: 12 },
  filterRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: '#374151',
  },
  filterChipTextActive: { color: '#ffffff' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#374151',
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'SpaceGrotesk-Regular',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    fontFamily: 'SpaceGrotesk-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
  },
  deleteBtn: {
    padding: 4,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'SpaceGrotesk-Regular',
    lineHeight: 20,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  noComment: {
    fontSize: 13,
    color: '#9ca3af',
    fontFamily: 'SpaceGrotesk-Regular',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reviewPerson: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewPersonText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  reviewDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'SpaceGrotesk-Regular',
  },
  sortOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  sortTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  sortOptionActive: { backgroundColor: '#fef3c7' },
  sortOptionText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk-Regular',
    color: '#374151',
  },
  sortOptionTextActive: {
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#92400e',
  },
  sortCheck: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  detailHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#111827',
  },
  detailBody: { paddingHorizontal: 24, paddingTop: 20 },
  detailRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  detailRatingNum: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk-Bold',
  },
  detailRatingLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  detailCommentBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  detailComment: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontFamily: 'SpaceGrotesk-Regular',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  detailInfoGrid: { gap: 12, marginBottom: 20 },
  detailInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
  },
  detailInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailInfoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'SpaceGrotesk-Regular',
    marginBottom: 2,
  },
  detailInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: '#111827',
  },
  detailDate: {
    fontSize: 13,
    color: '#9ca3af',
    fontFamily: 'SpaceGrotesk-Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
    marginBottom: 8,
  },
  deleteFullBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: '#ef4444',
  },
});
