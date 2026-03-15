import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { Trophy, Star, TrendingUp, Flame, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/marketplace/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

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
const MEDAL_LABELS = ['1st', '2nd', '3rd'];

function VendorAvatar({ name, logoUrl, size = 48 }: { name: string | null; logoUrl: string | null; size?: number }) {
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
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.33 }]}>{initials}</Text>
    </View>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <View style={[styles.medalBadge, { backgroundColor: MEDAL_COLORS[rank - 1] + '22' }]}>
        <Trophy size={10} color={MEDAL_COLORS[rank - 1]} strokeWidth={2.5} />
        <Text style={[styles.medalLabel, { color: MEDAL_COLORS[rank - 1] }]}>
          {MEDAL_LABELS[rank - 1]}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.rankCircle}>
      <Text style={styles.rankCircleText}>#{rank}</Text>
    </View>
  );
}

function VendorCard({
  entry,
  rank,
  tab,
  isTopRated,
  isMostOrdered,
}: {
  entry: VendorEntry;
  rank: number;
  tab: LeaderboardTab;
  isTopRated: boolean;
  isMostOrdered: boolean;
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: rank * 60,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
          rank === 1 && styles.cardFirst,
        ]}
      >
        {rank === 1 && (
          <LinearGradient
            colors={['#fffbeb', '#fef3c7']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        <View style={styles.cardInner}>
          <View style={styles.cardLeft}>
            <View style={styles.avatarWrap}>
              <VendorAvatar name={entry.business_name || 'Vendor'} logoUrl={entry.logo_url} size={44} />
              {rank <= 3 && (
                <View style={[styles.medalOverlay, { backgroundColor: MEDAL_COLORS[rank - 1] }]}>
                  <Text style={styles.medalOverlayText}>{rank}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
                  {entry.business_name || 'Vendor'}
                </Text>
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

              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Star size={10} color="#f5c518" strokeWidth={2} fill="#f5c518" />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>
                    {Number(entry.avg_rating).toFixed(1)}
                  </Text>
                </View>
                <View style={styles.statPill}>
                  <TrendingUp size={10} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>
                    {entry.weekly_order_count} this week
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardRight}>
            {tab === 'top_rated' ? (
              <View style={styles.scoreBlock}>
                <Text style={[styles.scoreValue, { color: colors.text }]}>
                  {Number(entry.avg_rating).toFixed(1)}
                </Text>
                <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>rating</Text>
              </View>
            ) : (
              <View style={styles.scoreBlock}>
                <Text style={[styles.scoreValue, { color: colors.primary }]}>
                  {entry.weekly_order_count}
                </Text>
                <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>orders</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function VendorLeaderboard() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<LeaderboardTab>('top_rated');
  const [vendors, setVendors] = useState<VendorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchLeaderboard();
    Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
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

  const topRatedId = vendors.length ? [...vendors].sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating))[0]?.vendor_id : null;
  const mostOrderedId = vendors.length ? [...vendors].sort((a, b) => Number(b.weekly_order_count) - Number(a.weekly_order_count))[0]?.vendor_id : null;

  const visible = expanded ? sorted : sorted.slice(0, 5);

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
            onPress={() => setTab('top_rated')}
            activeOpacity={0.8}
          >
            <Star size={13} color={tab === 'top_rated' ? '#0f172a' : 'rgba(255,255,255,0.6)'} strokeWidth={2.5} />
            <Text style={[styles.tabText, tab === 'top_rated' && styles.tabTextActive]}>
              Top Rated
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'most_ordered' && styles.tabActive]}
            onPress={() => setTab('most_ordered')}
            activeOpacity={0.8}
          >
            <TrendingUp size={13} color={tab === 'most_ordered' ? '#0f172a' : 'rgba(255,255,255,0.6)'} strokeWidth={2.5} />
            <Text style={[styles.tabText, tab === 'most_ordered' && styles.tabTextActive]}>
              Most Ordered
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[styles.listBox, { backgroundColor: colors.background }]}>
        {visible.map((entry, idx) => (
          <VendorCard
            key={entry.vendor_id}
            entry={entry}
            rank={idx + 1}
            tab={tab}
            isTopRated={entry.vendor_id === topRatedId}
            isMostOrdered={entry.vendor_id === mostOrderedId && entry.weekly_order_count > 0}
          />
        ))}

        {sorted.length > 5 && (
          <TouchableOpacity
            style={[styles.expandBtn, { borderColor: colors.borderLight }]}
            onPress={() => setExpanded((p) => !p)}
            activeOpacity={0.75}
          >
            <Text style={[styles.expandBtnText, { color: colors.primary }]}>
              {expanded ? 'Show less' : `Show ${sorted.length - 5} more vendors`}
            </Text>
          </TouchableOpacity>
        )}
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
  listBox: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 0,
  },
  cardFirst: {
    borderColor: '#f5c51888',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrap: {
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
  medalOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  medalOverlayText: {
    fontSize: 8,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  vendorName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  badgeTopRated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTopRatedText: {
    fontSize: 9,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeHotText: {
    fontSize: 9,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  cardRight: {
    alignItems: 'flex-end',
    minWidth: 48,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    marginTop: -1,
  },
  medalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  medalLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankCircleText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#64748b',
  },
  expandBtn: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  expandBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
});
