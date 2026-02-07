import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Star, TrendingUp, Timer, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Advert } from '@/types/database';
import { Fonts } from '@/constants/fonts';

const SLIDER_HORIZONTAL_MARGIN = 20;
const CARD_GAP = 12;
const AUTO_SCROLL_INTERVAL = 4000;

export default function PromoBannerSlider() {
  const [banners, setBanners] = useState<Advert[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const startAutoScroll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length <= 1 || cardWidth === 0) return;

    timerRef.current = setInterval(() => {
      if (isUserScrolling.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({
          x: next * (cardWidth + CARD_GAP),
          animated: true,
        });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
  }, [banners.length, cardWidth]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAutoScroll]);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('adverts')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

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

  const handleScrollBegin = () => {
    isUserScrolling.current = true;
  };

  const handleScrollEnd = () => {
    isUserScrolling.current = false;
    startAutoScroll();
  };

  const handleBannerPress = (banner: Advert) => {
    if (banner.action_url) {
      Linking.openURL(banner.action_url).catch(() => {});
    }
  };

  const handleLayout = (e: any) => {
    const containerWidth = e.nativeEvent.layout.width;
    setCardWidth(containerWidth - SLIDER_HORIZONTAL_MARGIN * 2);
  };

  if (banners.length === 0) return null;

  const getBadgeInfo = (banner: Advert) => {
    if (banner.hot_deal_text) return { text: banner.hot_deal_text, icon: Flame, colors: ['#ef4444', '#dc2626'] as const };
    if (banner.featured_text) return { text: banner.featured_text, icon: Star, colors: ['#f59e0b', '#d97706'] as const };
    if (banner.trending_text) return { text: banner.trending_text, icon: TrendingUp, colors: ['#059669', '#047857'] as const };
    if (banner.limited_offer_text) return { text: banner.limited_offer_text, icon: Timer, colors: ['#7c3aed', '#6d28d9'] as const };
    return null;
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
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
            contentContainerStyle={{
              paddingHorizontal: SLIDER_HORIZONTAL_MARGIN,
              gap: CARD_GAP,
            }}
          >
            {banners.map((banner, index) => {
              const badge = getBadgeInfo(banner);
              return (
                <TouchableOpacity
                  key={banner.id}
                  style={[styles.card, { width: cardWidth }]}
                  onPress={() => handleBannerPress(banner)}
                  activeOpacity={0.95}
                >
                  {banner.image_url ? (
                    <Image source={{ uri: banner.image_url }} style={styles.cardImage} />
                  ) : (
                    <LinearGradient
                      colors={['#ff9a1f', '#ff6b00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardImage}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.75)']}
                    style={styles.cardOverlay}
                  >
                    <View style={styles.cardContent}>
                      {badge && (
                        <View style={styles.badgeRow}>
                          <LinearGradient
                            colors={[...badge.colors]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.badge}
                          >
                            <badge.icon size={12} color="#ffffff" fill="#ffffff" />
                            <Text style={styles.badgeText}>{badge.text}</Text>
                          </LinearGradient>
                        </View>
                      )}
                      <Text style={styles.cardTitle} numberOfLines={2}>{banner.title}</Text>
                      <Text style={styles.cardDescription} numberOfLines={2}>{banner.description}</Text>
                      {banner.action_text && (
                        <View style={styles.actionRow}>
                          <Text style={styles.actionText}>{banner.action_text}</Text>
                          <ChevronRight size={14} color="#ffffff" strokeWidth={2.5} />
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {banners.length > 1 && (
            <View style={styles.pagination}>
              {banners.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === activeIndex && styles.dotActive,
                  ]}
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
  container: {
    marginBottom: 6,
  },
  card: {
    height: 170,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 5,
        }),
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  cardContent: {
    padding: 16,
    paddingBottom: 14,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  actionText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#d4d4d4',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#ff8c00',
  },
});
