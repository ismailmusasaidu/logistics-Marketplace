import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, StyleSheet,
  Linking, Dimensions, Animated, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Flame, Star, TrendingUp, Timer, ArrowRight, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/fonts';

const { width, height } = Dimensions.get('window');

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
};

interface AdModalProps {
  visible: boolean;
  advert: LogisticsAdvert | null;
  onClose: () => void;
}

const BADGE_CONFIG: Record<BadgeType, { icon: any; colors: [string, string]; labelColor: string }> = {
  hot_deal: { icon: Flame, colors: ['#ef4444', '#dc2626'], labelColor: '#fecaca' },
  featured: { icon: Star, colors: ['#f59e0b', '#d97706'], labelColor: '#fef3c7' },
  trending: { icon: TrendingUp, colors: ['#10b981', '#059669'], labelColor: '#d1fae5' },
  limited: { icon: Timer, colors: ['#3b82f6', '#2563eb'], labelColor: '#dbeafe' },
};

export default function LogisticsAdModal({ visible, advert, onClose }: AdModalProps) {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      slideAnim.setValue(40);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(sparkleAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      pulseAnim.setValue(1);
      sparkleAnim.setValue(0);
    }
  }, [visible]);

  if (!advert) return null;

  const badgeCfg = BADGE_CONFIG[advert.badge_type] ?? BADGE_CONFIG.featured;
  const BadgeIcon = badgeCfg.icon;

  const handleAction = async () => {
    if (advert.action_url) {
      try {
        let url = advert.action_url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          onClose();
        }
      } catch {}
    } else {
      onClose();
    }
  };

  const sparkleOpacity = sparkleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] });
  const sparkleRotate = sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <TouchableOpacity style={[styles.closeBtn, { top: 16 }]} onPress={onClose} activeOpacity={0.8}>
            <View style={styles.closeBtnInner}>
              <X size={18} color="#ffffff" />
            </View>
          </TouchableOpacity>

          <View style={styles.badgeAbsolute}>
            <LinearGradient colors={badgeCfg.colors} style={styles.badgeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <BadgeIcon size={13} color="#fff" fill="#fff" />
              <Text style={styles.badgeText}>{advert.badge_text}</Text>
            </LinearGradient>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} bounces={false}>
            {advert.image_url ? (
              <View style={styles.imgWrap}>
                <Image source={{ uri: advert.image_url }} style={styles.heroImg} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.imgGrad} />
              </View>
            ) : (
              <LinearGradient
                colors={['#1c1917', '#292524', '#431407']}
                style={styles.noImgHero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.noImgIconWrap}>
                  <LinearGradient colors={badgeCfg.colors} style={styles.noImgIconGrad}>
                    <BadgeIcon size={36} color="#fff" />
                  </LinearGradient>
                </View>
              </LinearGradient>
            )}

            <View style={styles.body}>
              <Animated.View style={[styles.sparkleWrap, { transform: [{ rotate: sparkleRotate }], opacity: sparkleOpacity }]}>
                <Sparkles size={28} color="#f97316" />
              </Animated.View>

              <Text style={styles.title}>{advert.title}</Text>

              {advert.description ? (
                <Text style={styles.desc}>{advert.description}</Text>
              ) : null}

              <View style={[styles.highlight, { borderColor: badgeCfg.colors[0] + '40', backgroundColor: badgeCfg.colors[0] + '10' }]}>
                <BadgeIcon size={18} color={badgeCfg.colors[0]} />
                <Text style={[styles.highlightText, { color: badgeCfg.colors[0] }]}>
                  {advert.badge_text}
                </Text>
              </View>

              {advert.action_text && (
                <Animated.View style={[styles.ctaBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
                  <TouchableOpacity onPress={handleAction} activeOpacity={0.85}>
                    <LinearGradient colors={['#f97316', '#ea580c', '#c2410c']} style={styles.ctaBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={styles.ctaBtnText}>{advert.action_text}</Text>
                      <View style={styles.ctaArrow}>
                        <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              )}

              <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.dismissText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: height * 0.88,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 20 }),
  },
  scrollContent: { paddingBottom: 8 },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  closeBtnInner: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeAbsolute: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  badgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.8, textTransform: 'uppercase' },
  imgWrap: { width: '100%', height: 220, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  imgGrad: { ...StyleSheet.absoluteFillObject },
  noImgHero: {
    width: '100%', height: 180,
    alignItems: 'center', justifyContent: 'center',
  },
  noImgIconWrap: { borderRadius: 28, overflow: 'hidden' },
  noImgIconGrad: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  body: { paddingHorizontal: 24, paddingTop: 24, alignItems: 'center' },
  sparkleWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff7ed', borderWidth: 2.5, borderColor: '#ffedd5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 26, fontFamily: Fonts.bold, color: '#111827',
    textAlign: 'center', letterSpacing: -0.5, lineHeight: 32, marginBottom: 10,
  },
  desc: {
    fontSize: 15, fontFamily: Fonts.regular, color: '#6b7280',
    textAlign: 'center', lineHeight: 22, marginBottom: 20,
  },
  highlight: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
    marginBottom: 24, alignSelf: 'stretch', justifyContent: 'center',
  },
  highlightText: { fontSize: 15, fontFamily: Fonts.bold, letterSpacing: 0.3 },
  ctaBtnWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  ctaBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10, paddingHorizontal: 24,
  },
  ctaBtnText: { fontSize: 17, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.4, textTransform: 'uppercase' },
  ctaArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  dismissBtn: { paddingVertical: 14, alignSelf: 'center' },
  dismissText: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#9ca3af' },
});
