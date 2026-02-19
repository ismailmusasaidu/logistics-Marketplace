import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  Animated,
  Platform,
  Clipboard,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X, Zap, Tag, Megaphone, PackagePlus, Star, Sparkles,
  Clock, Copy, Check, ArrowRight, Percent,
} from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Advert, AdvertType } from '@/types/database';

const { width, height } = Dimensions.get('window');

interface AdModalProps {
  visible: boolean;
  advert: Advert | null;
  onClose: () => void;
}

const TYPE_CONFIG: Record<AdvertType, { icon: any; label: string; gradientColors: [string, string]; accentColor: string }> = {
  promo:          { icon: Tag,        label: 'Promo',         gradientColors: ['#f97316', '#ea580c'], accentColor: '#f97316' },
  flash_sale:     { icon: Zap,        label: 'Flash Sale',    gradientColors: ['#ef4444', '#dc2626'], accentColor: '#ef4444' },
  announcement:   { icon: Megaphone,  label: 'Announcement',  gradientColors: ['#3b82f6', '#2563eb'], accentColor: '#3b82f6' },
  coupon:         { icon: Percent,    label: 'Coupon',        gradientColors: ['#f59e0b', '#d97706'], accentColor: '#f59e0b' },
  new_arrival:    { icon: PackagePlus,label: 'New Arrival',   gradientColors: ['#10b981', '#059669'], accentColor: '#10b981' },
  featured_brand: { icon: Star,       label: 'Featured',      gradientColors: ['#f59e0b', '#d97706'], accentColor: '#f59e0b' },
};

function formatCountdown(endDate: string): { text: string; urgent: boolean } {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return { text: 'Ended', urgent: false };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return { text: `${d}d ${h % 24}h left`, urgent: false };
  }
  return { text: h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`, urgent: h < 1 };
}

export default function AdModal({ visible, advert, onClose }: AdModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [copiedCode, setCopiedCode] = useState(false);
  const [countdown, setCountdown] = useState<{ text: string; urgent: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      opacityAnim.setValue(0);
      slideAnim.setValue(height);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      shimmerAnim.stopAnimation();
      setCopiedCode(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !advert?.countdown_end) return;
    setCountdown(formatCountdown(advert.countdown_end));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(advert.countdown_end!));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, advert?.countdown_end]);

  if (!advert) return null;

  const typeKey = (advert.advert_type ?? 'promo') as AdvertType;
  const cfg = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.promo;
  const TypeIcon = cfg.icon;

  const bgStart = advert.bg_color_start || cfg.gradientColors[0];
  const bgEnd = advert.bg_color_end || cfg.gradientColors[1];

  const handleAction = async () => {
    if (advert.action_url) {
      let url = advert.action_url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
      Linking.openURL(url).catch(() => {});
    }
    onClose();
  };

  const handleCopyCode = () => {
    if (advert.coupon_code) {
      if (Platform.OS === 'web') {
        navigator.clipboard?.writeText(advert.coupon_code).catch(() => {});
      } else {
        Clipboard.setString(advert.coupon_code);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.fullScreen, { transform: [{ translateY: slideAnim }] }]}>

          <LinearGradient
            colors={[bgStart, bgEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {advert.image_url && (
            <Image source={{ uri: advert.image_url }} style={styles.bgImage} resizeMode="cover" />
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
            style={StyleSheet.absoluteFillObject}
          />

          <TouchableOpacity
            style={[styles.closeBtn, { top: insets.top + 12 }]}
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <View style={styles.closeBtnInner}>
              <X size={20} color="#fff" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>

          <View style={[styles.topBadgeRow, { top: insets.top + 12 }]}>
            <View style={styles.typeBadge}>
              <TypeIcon size={12} color="#fff" />
              <Text style={styles.typeBadgeText}>{cfg.label}</Text>
            </View>
            {advert.discount_percent != null && advert.discount_percent > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{advert.discount_percent}%</Text>
              </View>
            )}
          </View>

          {!advert.image_url && (
            <View style={styles.centerIconWrap}>
              <Animated.View style={{ opacity: shimmerOpacity }}>
                <TypeIcon size={96} color="rgba(255,255,255,0.85)" strokeWidth={1.2} />
              </Animated.View>
            </View>
          )}

          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.title}>{advert.title}</Text>
              {advert.description ? (
                <Text style={styles.description}>{advert.description}</Text>
              ) : null}

              {advert.countdown_end && countdown && (
                <View style={[styles.countdownRow, countdown.urgent && styles.countdownUrgent]}>
                  <Clock size={15} color={countdown.urgent ? '#ef4444' : '#f97316'} />
                  <Text style={[styles.countdownText, countdown.urgent && styles.countdownTextUrgent]}>
                    {countdown.text}
                  </Text>
                  <Animated.View style={{ opacity: shimmerOpacity }}>
                    <Sparkles size={13} color={countdown.urgent ? '#ef4444' : '#f97316'} />
                  </Animated.View>
                </View>
              )}

              {advert.original_price != null && advert.promo_price != null && (
                <View style={styles.priceRow}>
                  <Text style={styles.promoPrice}>₦{advert.promo_price.toLocaleString()}</Text>
                  <Text style={styles.originalPrice}>₦{advert.original_price.toLocaleString()}</Text>
                  {advert.discount_percent != null && advert.discount_percent > 0 && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>Save {advert.discount_percent}%</Text>
                    </View>
                  )}
                </View>
              )}

              {advert.coupon_code && (
                <TouchableOpacity style={styles.couponRow} onPress={handleCopyCode} activeOpacity={0.8}>
                  <View style={styles.couponLeft}>
                    <Text style={styles.couponLabel}>
                      {advert.coupon_discount ? `${advert.coupon_discount} off` : 'Coupon Code'}
                    </Text>
                    <Text style={styles.couponCode}>{advert.coupon_code}</Text>
                  </View>
                  <View style={[styles.copyBtn, copiedCode && styles.copyBtnDone]}>
                    {copiedCode
                      ? <Check size={15} color="#fff" strokeWidth={2.5} />
                      : <Copy size={15} color="#fff" strokeWidth={2} />}
                    <Text style={styles.copyBtnText}>{copiedCode ? 'Copied!' : 'Copy'}</Text>
                  </View>
                </TouchableOpacity>
              )}

              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity onPress={handleAction} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[bgStart, bgEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaBtn}
                  >
                    <Text style={styles.ctaBtnText}>{advert.action_text || 'Shop Now'}</Text>
                    <View style={styles.ctaArrow}>
                      <ArrowRight size={17} color={bgStart} strokeWidth={2.5} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
                <Text style={styles.dismissText}>Maybe Later</Text>
              </TouchableOpacity>

              {advert.terms_text ? (
                <Text style={styles.termsText}>{advert.terms_text}</Text>
              ) : null}
            </ScrollView>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  fullScreen: {
    flex: 1,
    width,
    height,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  closeBtnInner: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  topBadgeRow: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  discountBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  centerIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 220,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.52,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 24 }),
  },
  scrollContent: {
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    lineHeight: 22,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  countdownUrgent: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  countdownText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#f97316',
  },
  countdownTextUrgent: {
    color: '#ef4444',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  promoPrice: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: '#ef4444',
    letterSpacing: -0.5,
  },
  originalPrice: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  saveBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  saveBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#d97706',
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    backgroundColor: '#fafafa',
  },
  couponLeft: {
    flex: 1,
    gap: 2,
  },
  couponLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  couponCode: {
    fontSize: 19,
    fontFamily: Fonts.bold,
    color: '#111827',
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnDone: {
    backgroundColor: '#10b981',
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: 18,
    gap: 10,
  },
  ctaBtnText: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  ctaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dismissText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#9ca3af',
  },
  termsText: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 16,
  },
});
