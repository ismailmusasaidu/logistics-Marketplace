import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, Linking, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Star, TrendingUp, Timer, ArrowRight, Megaphone } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';

type BadgeType = 'hot_deal' | 'featured' | 'trending' | 'limited';

type LogisticsAdvert = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  badge_text: string;
  badge_type: BadgeType;
  action_text: string | null;
  action_url: string | null;
  display_mode: string;
  display_frequency: string;
  priority: number;
  is_active: boolean;
};

interface BannerSliderProps {
  onModalAdvert?: (advert: LogisticsAdvert) => void;
}

const CARD_GAP = 10;
const AUTO_SCROLL_MS = 4500;

const BADGE_CONFIG: Record<BadgeType, { icon: any; color: string }> = {
  hot_deal: { icon: Flame, color: '#ef4444' },
  featured: { icon: Star, color: '#f59e0b' },
  trending: { icon: TrendingUp, color: '#10b981' },
  limited: { icon: Timer, color: '#3b82f6' },
};

export default function LogisticsBannerSlider({ onModalAdvert }: BannerSliderProps) {
  const [banners, setBanners] = useState<LogisticsAdvert[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrolling = useRef(false);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchBanners(); }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startAutoScroll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length <= 1 || cardWidth === 0) return;
    timerRef.current = setInterval(() => {
      if (isUserScrolling.current) return;
      setActiveIndex(prev => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * (cardWidth + CARD_GAP), animated: true });
        return next;
      });
    }, AUTO_SCROLL_MS);
  }, [banners.length, cardWidth]);

  useEffect(() => {
    startAutoScroll();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startAutoScroll]);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('logistics_adverts')
        .select('*')
        .eq('is_active', true)
        .in('display_mode', ['banner', 'both'])
        .order('priority', { ascending: false });
      if (error) throw error;
      setBanners(data || []);
    } catch {}
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth === 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / (cardWidth + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(index, banners.length - 1)));
  };

  const handleLayout = (e: any) => {
    const w = e.nativeEvent.layout.width;
    setCardWidth(w - 32);
  };

  const handlePress = (banner: LogisticsAdvert) => {
    if (banner.action_url) {
      Linking.openURL(banner.action_url).catch(() => {});
    }
  };

  if (banners.length === 0) return null;

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {cardWidth > 0 && (
        <>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIconWrap}>
              <Megaphone size={14} color="#f97316" />
            </View>
            <Text style={styles.sectionLabel}>Promotions & Offers</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled={false}
            snapToInterval={cardWidth + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onScrollBeginDrag={() => { isUserScrolling.current = true; }}
            onScrollEndDrag={() => { isUserScrolling.current = false; startAutoScroll(); }}
            onMomentumScrollEnd={() => { isUserScrolling.current = false; }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: 16, gap: CARD_GAP }}
          >
            {banners.map((banner, i) => {
              const cfg = BADGE_CONFIG[banner.badge_type] ?? BADGE_CONFIG.featured;
              const BadgeIcon = cfg.icon;
              return (
                <TouchableOpacity
                  key={banner.id}
                  style={[styles.card, { width: cardWidth }]}
                  onPress={() => handlePress(banner)}
                  activeOpacity={0.9}
                >
                  {banner.image_url ? (
                    <Image source={{ uri: banner.image_url }} style={styles.cardBg} resizeMode="cover" />
                  ) : (
                    <LinearGradient
                      colors={['#1c1917', '#292524', '#431407']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardBg}
                    />
                  )}

                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.78)']}
                    style={styles.overlay}
                  >
                    <View style={styles.cardTopRow}>
                      <Animated.View style={[styles.badge, { backgroundColor: cfg.color, opacity: shimmerOpacity }]}>
                        <BadgeIcon size={11} color="#fff" fill="#fff" />
                        <Text style={styles.badgeText}>{banner.badge_text}</Text>
                      </Animated.View>
                    </View>

                    <View style={styles.cardBottom}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{banner.title}</Text>
                      {banner.description ? (
                        <Text style={styles.cardDesc} numberOfLines={1}>{banner.description}</Text>
                      ) : null}
                      {banner.action_text ? (
                        <View style={styles.ctaRow}>
                          <Text style={styles.ctaText}>{banner.action_text}</Text>
                          <View style={styles.ctaArrow}>
                            <ArrowRight size={11} color="#f97316" strokeWidth={2.5} />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </LinearGradient>

                  <View style={styles.cardGloss} />
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
                  <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
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
  wrapper: { marginHorizontal: 0, marginBottom: 6 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, marginBottom: 10,
  },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 8, backgroundColor: '#fff7ed',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: { fontSize: 13, fontFamily: Fonts.bold, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: {
    height: 168, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1c1917',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 24px rgba(0,0,0,0.16)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 }),
  },
  cardBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, padding: 14, justifyContent: 'space-between' },
  cardGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18,
  },
  cardTopRow: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.6, textTransform: 'uppercase' },
  cardBottom: { gap: 4 },
  cardTitle: { fontSize: 17, fontFamily: Fonts.bold, color: '#ffffff', lineHeight: 22, letterSpacing: -0.2 },
  cardDesc: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.72)' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  ctaText: { fontSize: 12, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.88)' },
  ctaArrow: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d1d5db' },
  dotActive: { width: 20, backgroundColor: '#f97316', borderRadius: 3 },
});
