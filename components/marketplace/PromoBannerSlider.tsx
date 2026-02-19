import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, Linking, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Flame, Star, TrendingUp, Timer, ArrowRight, Zap, Tag,
  Megaphone, PackagePlus, Percent, Clock,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Advert, AdvertType } from '@/types/database';
import { Fonts } from '@/constants/fonts';

const SLIDER_PADDING = 16;
const CARD_GAP = 10;
const AUTO_SCROLL_INTERVAL = 4000;

const TYPE_CONFIG: Record<AdvertType, { icon: any; color: string; label: string }> = {
  promo:          { icon: Tag,         color: '#f97316', label: 'Promo' },
  flash_sale:     { icon: Zap,         color: '#ef4444', label: 'Flash Sale' },
  announcement:   { icon: Megaphone,   color: '#3b82f6', label: 'News' },
  coupon:         { icon: Percent,     color: '#8b5cf6', label: 'Coupon' },
  new_arrival:    { icon: PackagePlus, color: '#10b981', label: 'New' },
  featured_brand: { icon: Star,        color: '#f59e0b', label: 'Featured' },
};

const LEGACY_BADGE_CONFIG = [
  { key: 'hot_deal_text',      icon: Flame,      color: '#ef4444' },
  { key: 'featured_text',      icon: Star,       color: '#f59e0b' },
  { key: 'trending_text',      icon: TrendingUp, color: '#10b981' },
  { key: 'limited_offer_text', icon: Timer,      color: '#3b82f6' },
] as const;

function formatCountdownShort(endDate: string): string | null {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 23) return `${Math.floor(h / 24)}d left`;
  return h > 0 ? `${h}h ${m}m` : `${m}m left`;
}

export default function PromoBannerSlider() {
  const [banners, setBanners] = useState<Advert[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [countdowns, setCountdowns] = useState<Record<string, string | null>>({});
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrolling = useRef(false);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchBanners(); }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const flashSale = banners.filter(b => b.countdown_end);
    if (flashSale.length === 0) return;
    const tick = () => {
      const map: Record<string, string | null> = {};
      flashSale.forEach(b => { map[b.id] = formatCountdownShort(b.countdown_end!); });
      setCountdowns(map);
    };
    tick();
    countdownRef.current = setInterval(tick, 10_000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [banners]);

  const startAutoScroll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length <= 1 || cardWidth === 0) return;
    timerRef.current = setInterval(() => {
      if (isUserScrolling.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * (cardWidth + CARD_GAP), animated: true });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
  }, [banners.length, cardWidth]);

  useEffect(() => {
    startAutoScroll();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startAutoScroll]);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('adverts')
        .select('*')
        .eq('is_active', true)
        .or('display_position.eq.banner,display_position.eq.both,display_position.is.null')
        .order('priority', { ascending: false });
      if (error) throw error;
      setBanners((data as Advert[]) || []);
    } catch {}
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth === 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / (cardWidth + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(index, banners.length - 1)));
  };

  const handleScrollBegin = () => { isUserScrolling.current = true; };
  const handleScrollEnd = () => { isUserScrolling.current = false; startAutoScroll(); };

  const handleBannerPress = (banner: Advert) => {
    if (banner.action_url) Linking.openURL(banner.action_url).catch(() => {});
  };

  const handleLayout = (e: any) => {
    const w = e.nativeEvent.layout.width;
    setCardWidth(w - SLIDER_PADDING * 2);
  };

  if (banners.length === 0) return null;

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const getBannerBg = (banner: Advert): [string, string] => {
    if (banner.bg_color_start && banner.bg_color_end) return [banner.bg_color_start, banner.bg_color_end];
    const typeKey = banner.advert_type as AdvertType;
    const typeCfg = TYPE_CONFIG[typeKey];
    if (typeCfg) {
      const colorMap: Record<string, [string, string]> = {
        '#f97316': ['#1c1917', '#431407'],
        '#ef4444': ['#1c1917', '#450a0a'],
        '#3b82f6': ['#0f172a', '#1e3a5f'],
        '#8b5cf6': ['#1a1033', '#2e1065'],
        '#10b981': ['#022c22', '#064e3b'],
        '#f59e0b': ['#1c1917', '#451a03'],
      };
      return colorMap[typeCfg.color] ?? ['#1a1a1a', '#2d1a00'];
    }
    return ['#1a1a1a', '#2d1a00'];
  };

  const getTypeBadge = (banner: Advert) => {
    if (banner.advert_type) {
      const cfg = TYPE_CONFIG[banner.advert_type as AdvertType];
      if (cfg) return { icon: cfg.icon, text: cfg.label, color: cfg.color };
    }
    for (const leg of LEGACY_BADGE_CONFIG) {
      const val = (banner as any)[leg.key];
      if (val) return { icon: leg.icon, text: val, color: leg.color };
    }
    return null;
  };

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {cardWidth > 0 && (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled={false}
            snapToInterval={cardWidth + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBegin}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: SLIDER_PADDING, gap: CARD_GAP }}
          >
            {banners.map((banner) => {
              const badge = getTypeBadge(banner);
              const [bgStart, bgEnd] = getBannerBg(banner);
              const cdText = banner.countdown_end ? countdowns[banner.id] : null;
              const hasPrice = banner.promo_price != null && banner.original_price != null;
              const hasCoupon = !!banner.coupon_code;

              return (
                <TouchableOpacity
                  key={banner.id}
                  style={[styles.card, { width: cardWidth }]}
                  onPress={() => handleBannerPress(banner)}
                  activeOpacity={0.93}
                >
                  {banner.image_url ? (
                    <Image source={{ uri: banner.image_url }} style={styles.cardBg} resizeMode="cover" />
                  ) : (
                    <LinearGradient
                      colors={[bgStart, bgEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardBg}
                    />
                  )}

                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.72)']}
                    style={styles.overlay}
                  >
                    <View style={styles.topRow}>
                      {badge && (
                        <Animated.View style={[styles.badge, { backgroundColor: badge.color, opacity: shimmerOpacity }]}>
                          <badge.icon size={10} color="#fff" fill={badge.color} />
                          <Text style={styles.badgeText}>{badge.text}</Text>
                        </Animated.View>
                      )}
                      {banner.discount_percent != null && banner.discount_percent > 0 && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>-{banner.discount_percent}%</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.bottom}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{banner.title}</Text>

                      {hasPrice && (
                        <View style={styles.priceRow}>
                          <Text style={styles.promoPrice}>₦{banner.promo_price!.toLocaleString()}</Text>
                          <Text style={styles.originalPrice}>₦{banner.original_price!.toLocaleString()}</Text>
                        </View>
                      )}

                      {hasCoupon && !hasPrice && (
                        <View style={styles.couponChip}>
                          <Percent size={9} color="#fff" />
                          <Text style={styles.couponChipText}>{banner.coupon_code}</Text>
                        </View>
                      )}

                      {cdText && (
                        <View style={styles.countdownChip}>
                          <Clock size={9} color="#fbbf24" />
                          <Text style={styles.countdownChipText}>{cdText}</Text>
                        </View>
                      )}

                      {banner.action_text && !hasPrice && !hasCoupon && (
                        <View style={styles.ctaRow}>
                          <Text style={styles.ctaText}>{banner.action_text}</Text>
                          <View style={styles.ctaArrow}>
                            <ArrowRight size={11} color="#f97316" strokeWidth={2.5} />
                          </View>
                        </View>
                      )}

                      {(hasPrice || hasCoupon) && banner.action_text && (
                        <View style={styles.ctaRow}>
                          <Text style={styles.ctaText}>{banner.action_text}</Text>
                          <View style={styles.ctaArrow}>
                            <ArrowRight size={11} color="#f97316" strokeWidth={2.5} />
                          </View>
                        </View>
                      )}
                    </View>
                  </LinearGradient>

                  <View style={styles.gloss} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {banners.length > 1 && (
            <View style={styles.pagination}>
              {banners.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setActiveIndex(i);
                    scrollRef.current?.scrollTo({ x: i * (cardWidth + CARD_GAP), animated: true });
                  }}
                >
                  <View style={[styles.pagDot, i === activeIndex && styles.pagDotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
    paddingTop: 4,
  },
  card: {
    height: 168,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 24px rgba(0,0,0,0.14)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 7 }),
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 14,
    justifyContent: 'space-between',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  discountBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  discountBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  bottom: {
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoPrice: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fbbf24',
    letterSpacing: -0.2,
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.55)',
    textDecorationLine: 'line-through',
  },
  couponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  couponChipText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 1.2,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countdownChipText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#fbbf24',
    letterSpacing: 0.3,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.9)',
  },
  ctaArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  pagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d4d4d4',
  },
  pagDotActive: {
    width: 20,
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
});
