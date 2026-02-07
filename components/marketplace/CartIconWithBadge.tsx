import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';

interface CartIconWithBadgeProps {
  size: number;
  color: string;
}

export default function CartIconWithBadge({ size, color }: CartIconWithBadgeProps) {
  const { profile } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('carts')
        .select('quantity')
        .eq('user_id', profile.id);

      if (error) throw error;

      const totalQuantity = (data || []).reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalQuantity);
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchCartCount();

      // Subscribe to cart events
      const unsubscribe = cartEvents.subscribe(() => {
        fetchCartCount();
      });

      return unsubscribe;
    }
  }, [profile, fetchCartCount]);

  return (
    <View style={styles.container}>
      <ShoppingCart size={size} color={color} />
      {cartCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
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
