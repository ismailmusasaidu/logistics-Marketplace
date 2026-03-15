import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, ShoppingCart } from 'lucide-react-native';
import { useWishlist } from '@/contexts/WishlistContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/marketplace/supabase';
import { Product } from '@/types/database';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import { Fonts } from '@/constants/fonts';
import EmptyState from '@/components/EmptyState';
import { useRouter } from 'expo-router';

export default function WishlistScreen() {
  const { wishlistItems, removeFromWishlist, loading: wishlistLoading } = useWishlist();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlistProducts();
  }, [wishlistItems]);

  const fetchWishlistProducts = async () => {
    if (wishlistItems.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      const productIds = wishlistItems.map(item => item.product_id);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching wishlist products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (productId: string) => {
    await removeFromWishlist(productId);
  };

  const handleAddToCart = async (product: Product) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to add items to cart');
        return;
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from('carts')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingItem) {
        const { error: updateError } = await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('carts')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity: 1,
          });

        if (insertError) throw insertError;
      }

      cartEvents.emit();
      alert('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    }
  };

  if (loading || wishlistLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Wishlist</Text>
        </View>
        <View style={styles.emptyContainer}>
          <EmptyState
            variant="wishlist"
            title="Your wishlist is empty"
            subtitle="Save products you love to find them later."
            actionLabel="Browse Products"
            onAction={() => router.push('/(marketplace)')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Wishlist</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.itemCount, { color: colors.textSecondary }]}>{products.length} items</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {products.map((product) => (
          <View key={product.id} style={[styles.productCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Image
              source={{
                uri: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
              }}
              style={[styles.productImage, { backgroundColor: colors.surfaceSecondary }]}
            />
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={[styles.productDescription, { color: colors.textMuted }]} numberOfLines={2}>
                {product.description}
              </Text>
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.primaryDark }]}>₦{product.price.toFixed(2)}</Text>
                <Text style={[styles.unit, { color: colors.textMuted }]}>per {product.unit}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.addToCartButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleAddToCart(product)}
                >
                  <ShoppingCart size={18} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: colors.errorLight, borderColor: colors.error + '40' }]}
                  onPress={() => handleRemoveFromWishlist(product.id)}
                >
                  <Trash2 size={18} color={colors.error} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.spaceBold,
    letterSpacing: -0.5,
  },
  countBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  itemCount: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  productCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    borderWidth: 1,
  },
  productImage: {
    width: 110,
    height: 110,
    borderRadius: 10,
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontFamily: Fonts.spaceSemiBold,
    marginBottom: 4,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  productDescription: {
    fontSize: 13,
    fontFamily: Fonts.spaceRegular,
    marginBottom: 8,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 10,
  },
  price: {
    fontSize: 20,
    fontFamily: Fonts.spaceBold,
    letterSpacing: -0.4,
  },
  unit: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  addToCartButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addToCartText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    letterSpacing: 0.2,
  },
  removeButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
