import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Star, TrendingUp, Timer, ArrowRight } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Advert } from '@/types/database';
import { Fonts } from '@/constants/fonts';

const SLIDER_PADDING = 16;
const CARD_GAP = 10;
const AUTO_SCROLL_INTERVAL = 4000;

export default function PromoBannerSlider() {
  const [banners, setBanners] = useState<Advert[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => { fetchBanners(); }, []);

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
        .from('adverts').select('*').eq('is_active', true).order('priority', { ascending: false });
      if (error) throw error;
      setBanners((data as Advert[]) || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth === 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / (cardWidth + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(index, banners.length - 1)));
  };

  const handleScrollBegin = () => { isUserScrolling.current = true; };

  const handleScrollEnd = () => {
    isUserScrolling.current = false;
    startAutoScroll();
  };

  const handleBannerPress = (banner: Advert) => {
    if (banner.action_url) Linking.openURL(banner.action_url).catch(() => {});
  };

  const handleLayout = (e: any) => {
    const containerWidth = e.nativeEvent.layout.width;
    setCardWidth(containerWidth - SLIDER_PADDING * 2);
  };

  if (banners.length === 0) return null;

  const getBadgeInfo = (banner: Advert) => {
    if (banner.hot_deal_text) return { text: banner.hot_deal_text, icon: Flame, color: '#ef4444' };
    if (banner.featured_text) return { text: banner.featured_text, icon: Star, color: '#f59e0b' };
    if (banner.trending_text) return { text: banner.trending_text, icon: TrendingUp, color: '#10b981' };
    if (banner.limited_offer_text) return { text: banner.limited_offer_text, icon: Timer, color: '#3b82f6' };
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
              const badge = getBadgeInfo(banner);
              return (
                <TouchableOpacity
                  key={banner.id}
                  style={[styles.card, { width: cardWidth }]}
                  onPress={() => handleBannerPress(banner)}
                  activeOpacity={0.93}
                >
                  {banner.image_url ? (
                    <Image source={{ uri: banner.image_url }} style={styles.cardBg} />
                  ) : (
                    <LinearGradient
                      colors={['#1a1a1a', '#2d1a00', '#f97316']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardBg}
                    />
                  )}

                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)']}
                    style={styles.overlay}
                  >
                    {badge && (
                      <View style={[styles.badge, { backgroundColor: badge.color }]}>
                        <badge.icon size={11} color="#ffffff" fill="#ffffff" />
                        <Text style={styles.badgeText}>{badge.text}</Text>
                      </View>
                    )}

                    <Text style={styles.cardTitle} numberOfLines={2}>{banner.title}</Text>

                    {banner.description ? (
                      <Text style={styles.cardDesc} numberOfLines={1}>{banner.description}</Text>
                    ) : null}

                    {banner.action_text && (
                      <View style={styles.ctaRow}>
                        <Text style={styles.ctaText}>{banner.action_text}</Text>
                        <View style={styles.ctaArrow}>
                          <ArrowRight size={12} color="#f97316" strokeWidth={2.5} />
                        </View>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {banners.length > 1 && (
            <View style={styles.pagination}>
              {banners.map((_, i) => (
                <View
                  key={i}
                  style={[styles.pagDot, i === activeIndex && styles.pagDotActive]}
                />
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
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
        }),
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 14,
    gap: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.75)',
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
  },
});
