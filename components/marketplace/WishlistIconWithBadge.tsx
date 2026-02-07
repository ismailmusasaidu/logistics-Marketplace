import { View, Text, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useWishlist } from '@/contexts/WishlistContext';

interface WishlistIconWithBadgeProps {
  size: number;
  color: string;
}

export default function WishlistIconWithBadge({ size, color }: WishlistIconWithBadgeProps) {
  const { wishlistItems } = useWishlist();
  const wishlistCount = wishlistItems.length;

  return (
    <View style={styles.container}>
      <Heart size={size} color={color} />
      {wishlistCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{wishlistCount > 99 ? '99+' : wishlistCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
