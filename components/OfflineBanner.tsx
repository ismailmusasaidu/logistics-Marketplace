import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { WifiOff, Clock } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

interface OfflineBannerProps {
  isStale?: boolean;
  lastUpdated?: Date | null;
  message?: string;
}

export default function OfflineBanner({ isStale, lastUpdated, message }: OfflineBannerProps) {
  const slideAnim = useRef(new Animated.Value(-44)).current;

  useEffect(() => {
    if (isStale) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -44, duration: 300, useNativeDriver: true }).start();
    }
  }, [isStale]);

  const formatAge = (date: Date | null | undefined): string => {
    if (!date) return '';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const displayMessage = message || (lastUpdated ? `Showing saved data from ${formatAge(lastUpdated)}` : 'Showing saved data');

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <WifiOff size={14} color="#ffffff" />
      <Text style={styles.text}>{displayMessage}</Text>
      {lastUpdated && <Clock size={12} color="rgba(255,255,255,0.7)" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#78716c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
    zIndex: 100,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
  },
});
