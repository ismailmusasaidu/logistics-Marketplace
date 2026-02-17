import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import { router, useFocusEffect } from 'expo-router';
import ProductDetailModal from '@/components/marketplace/ProductDetailModal';
import { Product } from '@/types/database';
import { Fonts } from '@/constants/fonts';

interface CartItemWithProduct {
  id: string;
  quantity: number;
  product_id: string;
  product: {
    id: string;
    name: string;
    price: number;
    unit: string;
    image_url: string;
    vendor_id: string;
  };
}

export default function CartScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        fetchCartItems();
      }
    }, [profile])
  );

  useEffect(() => {
    if (!profile) return;

    // Subscribe to real-time cart changes
    const channel = supabase
      .channel('cart-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'carts',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          // Add a small delay to ensure the database has fully committed the change
          setTimeout(() => {
            fetchCartItems();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchCartItems = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('carts')
        .select(
          `
          id,
          quantity,
          product_id,
          products (
            id,
            name,
            price,
            unit,
            image_url,
            vendor_id
          )
        `
        )
        .eq('user_id', profile.id);

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        product_id: item.product_id,
        product: item.products,
      }));

      setCartItems(formattedData);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (cartId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      const { error } = await supabase
        .from('carts')
        .update({ quantity: newQuantity })
        .eq('id', cartId);

      if (error) throw error;

      setCartItems(
        cartItems.map((item) =>
          item.id === cartId ? { ...item, quantity: newQuantity } : item
        )
      );

      // Emit cart event to update badge
      cartEvents.emit();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const removeItem = async (cartId: string) => {
    try {
      const { error } = await supabase.from('carts').delete().eq('id', cartId);

      if (error) throw error;

      setCartItems(cartItems.filter((item) => item.id !== cartId));

      // Emit cart event to update badge
      cartEvents.emit();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    router.push('/checkout');
  };

  const handleViewProduct = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedProduct(data as Product);
        setShowProductDetail(true);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag size={80} color="#d1d5db" />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyText}>Add some products to get started</Text>
        <TouchableOpacity style={styles.shopButton} onPress={() => router.push('/(marketplace)')}>
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>My Cart</Text>
        <Text style={styles.itemCount}>{cartItems.length} items</Text>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleViewProduct(item.product_id)}
          >
            <View style={styles.cartItem}>
              <Image
                source={{
                  uri: item.product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
                }}
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemPrice}>
                  ₦{item.product.price.toFixed(2)} / {item.product.unit}
                </Text>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      updateQuantity(item.id, item.quantity - 1);
                    }}
                  >
                    <Minus size={16} color="#6b7280" />
                  </TouchableOpacity>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      updateQuantity(item.id, item.quantity + 1);
                    }}
                  >
                    <Plus size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
              >
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₦{calculateTotal().toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>

      <ProductDetailModal
        visible={showProductDetail}
        product={selectedProduct}
        onClose={() => {
          setShowProductDetail(false);
          setSelectedProduct(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.spaceBold,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  itemCount: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  list: {
    padding: 12,
    paddingTop: 10,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0ebe4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#f0ebe4',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemName: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1a1a1a',
    letterSpacing: -0.1,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    color: '#c2410c',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#f8f5f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  quantity: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    marginHorizontal: 10,
    color: '#1a1a1a',
  },
  deleteButton: {
    justifyContent: 'center',
    padding: 6,
  },
  footer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  totalAmount: {
    fontSize: 24,
    fontFamily: Fonts.spaceBold,
    color: '#c2410c',
    letterSpacing: -0.8,
  },
  checkoutButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.spaceBold,
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: Fonts.spaceBold,
    color: '#1a1a1a',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  shopButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 24,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  shopButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.spaceBold,
    letterSpacing: 0.3,
  },
});
