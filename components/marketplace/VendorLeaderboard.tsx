import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AppState,
} from 'react-native';
import { Trophy, Star, TrendingUp, Flame } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/marketplace/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface VendorEntry {
  vendor_id: string;
  business_name: string | null;
  logo_url: string | null;
  avg_rating: number;
  total_products: number;
  weekly_order_count: number;
  total_order_count: number;
}

type LeaderboardTab = 'top_rated' | 'most_ordered';

const MEDAL_COLORS = ['#f5c518', '#b0bec5', '#cd7f32'];

function VendorAvatar({ name, logoUrl, size = 56 }: { name: string | null; logoUrl: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || 'V')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (logoUrl && !imgError) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.33 }]}>{initials}</Text>
    </View>
  );
}

function VendorSlideCard({
  entry,
  rank,
  tab,
  isTopRated,
  isMostOrdered,
  onPress,
}: {
  entry: VendorEntry;
  rank: number;
  tab: LeaderboardTab;
  isTopRated: boolean;
  isMostOrdered: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const isTop3 = rank <= 3;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.slideCard, { width: CARD_WIDTH, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
    >
      {rank === 1 && (
        <LinearGradient
          colors={['#fffbeb', '#fef3c7']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <View style={styles.slideCardInner}>
        <View style={styles.rankSection}>
          {isTop3 ? (
            <View style={[styles.rankMedalCircle, { backgroundColor: MEDAL_COLORS[rank - 1] + '22', borderColor: MEDAL_COLORS[rank - 1] + '55' }]}>
              <Trophy size={14} color={MEDAL_COLORS[rank - 1]} strokeWidth={2.5} />
              <Text style={[styles.rankMedalText, { color: MEDAL_COLORS[rank - 1] }]}>#{rank}</Text>
            </View>
          ) : (
            <View style={[styles.rankNumberCircle, { backgroundColor: colors.backgroundSecondary || '#f1f5f9' }]}>
              <Text style={[styles.rankNumberText, { color: colors.textSecondary }]}>#{rank}</Text>
            </View>
          )}
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <VendorAvatar name={entry.business_name || 'Vendor'} logoUrl={entry.logo_url} size={64} />
            {isTop3 && (
              <View style={[styles.medalPin, { backgroundColor: MEDAL_COLORS[rank - 1] }]}>
                <Text style={styles.medalPinText}>{rank}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
          {entry.business_name || 'Vendor'}
        </Text>

        <View style={styles.badgesRow}>
          {isTopRated && (
            <View style={styles.badgeTopRated}>
              <Star size={9} color="#f97316" strokeWidth={2.5} />
              <Text style={styles.badgeTopRatedText}>Top Rated</Text>
            </View>
          )}
          {isMostOrdered && (
            <View style={styles.badgeHot}>
              <Flame size={9} color="#ef4444" strokeWidth={2.5} />
              <Text style={styles.badgeHotText}>Hot</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: '#fef9c3' }]}>
            <Star size={14} color="#f5c518" strokeWidth={2} fill="#f5c518" />
            <Text style={styles.statBoxValue}>{Number(entry.avg_rating).toFixed(1)}</Text>
            <Text style={styles.statBoxLabel}>Rating</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#eff6ff' }]}>
            <TrendingUp size={14} color="#3b82f6" strokeWidth={2} />
            <Text style={[styles.statBoxValue, { color: '#3b82f6' }]}>{entry.weekly_order_count}</Text>
            <Text style={styles.statBoxLabel}>This week</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#f0fdf4' }]}>
            <Trophy size={14} color="#22c55e" strokeWidth={2} />
            <Text style={[styles.statBoxValue, { color: '#22c55e' }]}>{entry.total_order_count}</Text>
            <Text style={styles.statBoxLabel}>All time</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function VendorLeaderboard({ onVendorPress }: { onVendorPress?: (vendorId: string, vendorName: string) => void }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<LeaderboardTab>('top_rated');
  const [vendors, setVendors] = useState<VendorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const headerFade = useRef(new Animated.Value(0)).current;
  const autoSlideRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIndexRef = useRef(0);
  const sortedRef = useRef<VendorEntry[]>([]);

  const startAutoSlide = useCallback(() => {
    if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    autoSlideRef.current = setInterval(() => {
      const total = sortedRef.current.length;
      if (total === 0) return;
      const next = (activeIndexRef.current + 1) % total;
      flatListRef.current?.scrollToOffset({ offset: next * CARD_WIDTH, animated: true });
      activeIndexRef.current = next;
      setActiveIndex(next);
    }, 3500);
  }, []);

  const stopAutoSlide = useCallback(() => {
    if (autoSlideRef.current) {
      clearInterval(autoSlideRef.current);
      autoSlideRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    return () => stopAutoSlide();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendor_leaderboard')
        .select('*')
        .order('avg_rating', { ascending: false })
        .limit(20);
      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...vendors].sort((a, b) => {
    if (tab === 'top_rated') return Number(b.avg_rating) - Number(a.avg_rating);
    return Number(b.weekly_order_count) - Number(a.weekly_order_count);
  });

  useEffect(() => {
    sortedRef.current = sorted;
    if (sorted.length > 1) startAutoSlide();
  }, [vendors, tab]);

  const topRatedId = vendors.length
    ? [...vendors].sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating))[0]?.vendor_id
    : null;
  const mostOrderedId = vendors.length
    ? [...vendors].sort((a, b) => Number(b.weekly_order_count) - Number(a.weekly_order_count))[0]?.vendor_id
    : null;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    activeIndexRef.current = idx;
    setActiveIndex(idx);
    startAutoSlide();
  }, [startAutoSlide]);

  const handleTabChange = (newTab: LeaderboardTab) => {
    setTab(newTab);
    setActiveIndex(0);
    activeIndexRef.current = 0;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  if (loading) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (vendors.length === 0) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity: headerFade }]}>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <View style={styles.trophyCircle}>
              <Trophy size={16} color="#f5c518" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Vendor Leaderboard</Text>
              <Text style={styles.headerSub}>Performance rankings updated live</Text>
            </View>
          </View>
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'top_rated' && styles.tabActive]}
            onPress={() => handleTabChange('top_rated')}
            activeOpacity={0.8}
          >
            <Star size={13} color={tab === 'top_rated' ? '#0f172a' : 'rgba(255,255,255,0.6)'} strokeWidth={2.5} />
            <Text style={[styles.tabText, tab === 'top_rated' && styles.tabTextActive]}>Top Rated</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'most_ordered' && styles.tabActive]}
            onPress={() => handleTabChange('most_ordered')}
            activeOpacity={0.8}
          >
            <TrendingUp size={13} color={tab === 'most_ordered' ? '#0f172a' : 'rgba(255,255,255,0.6)'} strokeWidth={2.5} />
            <Text style={[styles.tabText, tab === 'most_ordered' && styles.tabTextActive]}>Most Ordered</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[styles.sliderContainer, { backgroundColor: colors.background }]}>
        <FlatList
          ref={flatListRef}
          data={sorted}
          keyExtractor={(item) => item.vendor_id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH}
          snapToAlignment="center"
          decelerationRate="fast"
          contentContainerStyle={styles.flatListContent}
          onMomentumScrollEnd={handleScroll}
          onScrollBeginDrag={stopAutoSlide}
          renderItem={({ item, index }) => (
            <VendorSlideCard
              entry={item}
              rank={index + 1}
              tab={tab}
              isTopRated={item.vendor_id === topRatedId}
              isMostOrdered={item.vendor_id === mostOrderedId && item.weekly_order_count > 0}
              onPress={() => onVendorPress?.(item.vendor_id, item.business_name || 'Vendor')}
            />
          )}
        />

        <View style={styles.dotsRow}>
          {sorted.slice(0, Math.min(sorted.length, 10)).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                flatListRef.current?.scrollToOffset({ offset: i * CARD_WIDTH, animated: true });
                setActiveIndex(i);
              }}
            >
              <View
                style={[
                  styles.dot,
                  i === activeIndex ? [styles.dotActive, { backgroundColor: colors.primary }] : { backgroundColor: colors.borderLight },
                ]}
              />
            </TouchableOpacity>
          ))}
          {sorted.length > 10 && (
            <Text style={[styles.dotsMore, { color: colors.textMuted }]}>+{sorted.length - 10}</Text>
          )}
        </View>

        <Text style={[styles.swipeHint, { color: colors.textMuted }]}>
          {activeIndex + 1} of {sorted.length} vendors · swipe to explore
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  loadingBox: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trophyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#22c55e',
    letterSpacing: 0.8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#f5c518',
  },
  tabText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  sliderContainer: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  flatListContent: {
    paddingHorizontal: 16,
    gap: CARD_MARGIN,
  },
  slideCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: CARD_MARGIN,
  },
  slideCardInner: {
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  rankSection: {
    alignSelf: 'flex-start',
  },
  rankMedalCircle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rankMedalText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  rankNumberCircle: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rankNumberText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  avatarSection: {
    marginTop: 4,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarFallback: {
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  medalPin: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  medalPinText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  vendorName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badgeTopRated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeTopRatedText: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: '#f97316',
  },
  badgeHot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeHotText: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  statBoxValue: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  statBoxLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: '#64748b',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
  },
  dotsMore: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginLeft: 2,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Fonts.regular,
    marginTop: 6,
  },
});
