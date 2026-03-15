import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, Line, Polyline, G, Ellipse, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

type EmptyVariant =
  | 'orders'
  | 'products'
  | 'notifications'
  | 'search'
  | 'wishlist'
  | 'cart'
  | 'riders'
  | 'generic';

interface EmptyStateProps {
  variant?: EmptyVariant;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  size?: 'small' | 'medium' | 'large';
}

function OrdersIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Rect x="20" y="30" width="80" height="65" rx="8" fill={color + '20'} stroke={color} strokeWidth="2" />
      <Rect x="35" y="20" width="50" height="20" rx="4" fill={color + '30'} stroke={color} strokeWidth="2" />
      <Line x1="35" y1="55" x2="85" y2="55" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="35" y1="68" x2="75" y2="68" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="35" y1="81" x2="65" y2="81" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="90" cy="90" r="14" fill={color + '20'} stroke={color} strokeWidth="2" />
      <Path d="M85 90l4 4 8-8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProductsIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Rect x="15" y="40" width="38" height="38" rx="6" fill={color + '20'} stroke={color} strokeWidth="2" />
      <Rect x="67" y="40" width="38" height="38" rx="6" fill={color + '15'} stroke={color} strokeWidth="2" />
      <Rect x="41" y="15" width="38" height="38" rx="6" fill={color + '25'} stroke={color} strokeWidth="2" />
      <Path d="M24 62h20M34 52v20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="86" cy="59" r="6" fill={color + '40'} stroke={color} strokeWidth="1.5" />
      <Path d="M50 28l6 6 10-10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 88 Q60 72 105 88" stroke={color + '60'} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
    </Svg>
  );
}

function NotificationsIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Path d="M60 20 C42 20 30 33 30 50 L30 72 L20 82 L100 82 L90 72 L90 50 C90 33 78 20 60 20Z" fill={color + '20'} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M50 82 Q50 94 60 94 Q70 94 70 82" fill={color + '30'} stroke={color} strokeWidth="2" />
      <Line x1="60" y1="14" x2="60" y2="22" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="88" cy="28" r="10" fill="#ef4444" />
      <SvgText x="84" y="32" fontSize={10} fill="white" fontFamily="sans-serif">Z</SvgText>
    </Svg>
  );
}

function SearchIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx="52" cy="52" r="28" fill={color + '15'} stroke={color} strokeWidth="2.5" />
      <Line x1="72" y1="72" x2="96" y2="96" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Line x1="44" y1="52" x2="60" y2="52" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="52" y1="44" x2="52" y2="60" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M36 38 Q52 28 68 38" stroke={color + '50'} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function WishlistIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Path d="M60 90 L30 62 C18 50 18 32 30 24 C36 20 44 20 50 24 L60 34 L70 24 C76 20 84 20 90 24 C102 32 102 50 90 62 Z" fill={color + '20'} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M60 78 L40 60 C34 54 34 44 40 38" stroke={color + '60'} strokeWidth="1.5" strokeLinecap="round" />
      <Circle cx="88" cy="28" r="8" fill="white" stroke={color} strokeWidth="1.5" />
      <Line x1="88" y1="24" x2="88" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="84" y1="28" x2="92" y2="28" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function CartIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Path d="M18 24 L30 24 L42 74 L90 74 L100 42 L36 42" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x="36" y="42" width="64" height="32" rx="4" fill={color + '15'} />
      <Circle cx="50" cy="88" r="8" fill={color + '30'} stroke={color} strokeWidth="2" />
      <Circle cx="80" cy="88" r="8" fill={color + '30'} stroke={color} strokeWidth="2" />
      <Line x1="55" y1="55" x2="90" y2="55" stroke={color + '60'} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 3" />
    </Svg>
  );
}

function RidersIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx="60" cy="30" r="14" fill={color + '20'} stroke={color} strokeWidth="2" />
      <Path d="M35 80 C35 62 85 62 85 80 L85 95 L35 95 Z" fill={color + '15'} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Ellipse cx="60" cy="95" rx="35" ry="8" fill={color + '10'} />
      <Path d="M20 72 Q60 55 100 72" stroke={color + '40'} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
    </Svg>
  );
}

function GenericIllustration({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx="60" cy="60" r="40" fill={color + '12'} stroke={color} strokeWidth="2" />
      <Line x1="60" y1="38" x2="60" y2="66" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Circle cx="60" cy="78" r="3" fill={color} />
    </Svg>
  );
}

const illustrations: Record<EmptyVariant, React.FC<{ color: string; size: number }>> = {
  orders: OrdersIllustration,
  products: ProductsIllustration,
  notifications: NotificationsIllustration,
  search: SearchIllustration,
  wishlist: WishlistIllustration,
  cart: CartIllustration,
  riders: RidersIllustration,
  generic: GenericIllustration,
};

const sizeMap = { small: 80, medium: 110, large: 140 };

export default function EmptyState({
  variant = 'generic',
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  size = 'medium',
}: EmptyStateProps) {
  const { colors } = useTheme();
  const Illustration = illustrations[variant];
  const illustrationSize = sizeMap[size];

  return (
    <View style={styles.container}>
      <View style={[styles.illustrationWrapper, { backgroundColor: colors.surfaceSecondary }]}>
        {icon || <Illustration color={colors.primary} size={illustrationSize} />}
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.spaceBold }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionText, { fontFamily: Fonts.spaceSemiBold }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  illustrationWrapper: {
    borderRadius: 999,
    padding: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'SpaceGrotesk-Regular',
  },
  actionButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 15,
  },
});
