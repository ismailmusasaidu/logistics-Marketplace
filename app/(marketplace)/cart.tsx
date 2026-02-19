import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Plus, Minus, ShoppingBag, Scale, RotateCcw, X, ShieldCheck, Clock, AlertCircle } from 'lucide-react-native';
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
    weight_kg: number | null;
    return_policy: string | null;
  };
}

interface WeightSurchargeTier {
  id: string;
  min_weight_kg: number;
  max_weight_kg: number | null;
  charge_amount: number;
  label: string;
}

export default function CartScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const suppressRealtimeRef = useRef(false);
  const [weightSurchargeTiers, setWeightSurchargeTiers] = useState<WeightSurchargeTier[]>([]);
  const [returnPolicyProduct, setReturnPolicyProduct] = useState<{ name: string; policy: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        fetchCartItems();
        fetchWeightSurchargeTiers();
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
        () => {
          if (suppressRealtimeRef.current) return;
          setTimeout(() => {
            fetchCartItems(false);
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchCartItems = async (showLoader = true) => {
    if (!profile) return;

    try {
      if (showLoader) setLoading(true);
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
            vendor_id,
            weight_kg,
            return_policy
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

    setCartItems((prev) =>
      prev.map((item) => (item.id === cartId ? { ...item, quantity: newQuantity } : item))
    );

    suppressRealtimeRef.current = true;
    try {
      const { error } = await supabase
        .from('carts')
        .update({ quantity: newQuantity })
        .eq('id', cartId);

      if (error) throw error;

      cartEvents.emit();
    } catch (error) {
      console.error('Error updating quantity:', error);
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === cartId ? { ...item, quantity: newQuantity - 1 } : item
        )
      );
    } finally {
      setTimeout(() => {
        suppressRealtimeRef.current = false;
      }, 500);
    }
  };

  const removeItem = async (cartId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== cartId));

    suppressRealtimeRef.current = true;
    try {
      const { error } = await supabase.from('carts').delete().eq('id', cartId);

      if (error) throw error;

      cartEvents.emit();
    } catch (error) {
      console.error('Error removing item:', error);
      fetchCartItems(false);
    } finally {
      setTimeout(() => {
        suppressRealtimeRef.current = false;
      }, 500);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const calculateTotalWeight = () => {
    return cartItems.reduce((sum, item) => {
      if (item.product.weight_kg == null) return sum;
      return sum + item.product.weight_kg * item.quantity;
    }, 0);
  };

  const fetchWeightSurchargeTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('weight_surcharge_tiers')
        .select('id, min_weight_kg, max_weight_kg, charge_amount, label')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setWeightSurchargeTiers(data || []);
    } catch (err) {
      console.error('Error fetching weight surcharge tiers:', err);
    }
  };

  const getApplicableWeightSurcharge = (): WeightSurchargeTier | null => {
    const totalWeight = calculateTotalWeight();
    if (totalWeight === 0 || !hasAnyWeight) return null;
    return (
      weightSurchargeTiers.find((tier) => {
        const min = Number(tier.min_weight_kg);
        const max = tier.max_weight_kg != null ? Number(tier.max_weight_kg) : null;
        const charge = Number(tier.charge_amount);
        if (isNaN(min) || isNaN(charge)) return false;
        return totalWeight >= min && (max == null || totalWeight < max);
      }) ?? null
    );
  };

  const hasAnyWeight = cartItems.some((item) => item.product.weight_kg != null);

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
                {item.product.weight_kg != null && (
                  <View style={styles.itemWeightRow}>
                    <Scale size={11} color="#9ca3af" strokeWidth={2} />
                    <Text style={styles.itemWeightText}>
                      {(item.product.weight_kg * item.quantity).toFixed(3)} kg
                      {item.quantity > 1 && (
                        <Text style={styles.itemWeightUnit}> ({item.product.weight_kg} kg each)</Text>
                      )}
                    </Text>
                  </View>
                )}
                <View style={styles.itemBottomRow}>
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
                  {item.product.return_policy ? (
                    <TouchableOpacity
                      style={styles.returnPolicyBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setReturnPolicyProduct({ name: item.product.name, policy: item.product.return_policy! });
                      }}
                    >
                      <RotateCcw size={11} color="#059669" strokeWidth={2.2} />
                      <Text style={styles.returnPolicyBtnText}>Return Policy</Text>
                    </TouchableOpacity>
                  ) : null}
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
        {hasAnyWeight && (
          <View style={styles.weightContainer}>
            <View style={styles.weightIconWrap}>
              <Scale size={14} color="#ff8c00" strokeWidth={2.2} />
            </View>
            <Text style={styles.weightLabel}>Total Weight</Text>
            <Text style={styles.weightValue}>
              {calculateTotalWeight() >= 1
                ? `${calculateTotalWeight().toFixed(3)} kg`
                : `${(calculateTotalWeight() * 1000).toFixed(0)} g`}
            </Text>
          </View>
        )}
        {(() => {
          const surcharge = getApplicableWeightSurcharge();
          if (!surcharge) return null;
          return (
            <View style={styles.surchargeContainer}>
              <View style={styles.surchargeLeft}>
                <Scale size={13} color="#b45309" strokeWidth={2} />
                <View>
                  <Text style={styles.surchargeLabel}>{surcharge.label}</Text>
                  <Text style={styles.surchargeHint}>Weight-based additional charge</Text>
                </View>
              </View>
              <Text style={styles.surchargeAmount}>
                +₦{Number(surcharge.charge_amount).toFixed(2)}
              </Text>
            </View>
          );
        })()}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>
            ₦{(calculateTotal() + Number(getApplicableWeightSurcharge()?.charge_amount ?? 0)).toFixed(2)}
          </Text>
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

      <Modal
        visible={!!returnPolicyProduct}
        transparent
        animationType="slide"
        onRequestClose={() => setReturnPolicyProduct(null)}
      >
        <View style={styles.rpOverlay}>
          <TouchableOpacity style={styles.rpBackdrop} onPress={() => setReturnPolicyProduct(null)} />
          <View style={[styles.rpSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.rpHandle} />

            <View style={styles.rpHeader}>
              <View style={styles.rpHeaderLeft}>
                <View style={styles.rpIconWrap}>
                  <ShieldCheck size={22} color="#059669" strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.rpTitle}>Return Policy</Text>
                  <Text style={styles.rpProductName} numberOfLines={1}>{returnPolicyProduct?.name}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.rpCloseBtn} onPress={() => setReturnPolicyProduct(null)}>
                <X size={18} color="#64748b" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.rpBody} showsVerticalScrollIndicator={false}>
              <View style={styles.rpNotice}>
                <AlertCircle size={14} color="#0369a1" strokeWidth={2} />
                <Text style={styles.rpNoticeText}>
                  Please read this policy carefully before making a purchase.
                </Text>
              </View>

              <Text style={styles.rpPolicyText}>{returnPolicyProduct?.policy}</Text>

              <View style={styles.rpFooterNote}>
                <Clock size={13} color="#94a3b8" strokeWidth={2} />
                <Text style={styles.rpFooterNoteText}>
                  Contact the vendor or support team to initiate a return.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.rpDoneBtn} onPress={() => setReturnPolicyProduct(null)}>
              <Text style={styles.rpDoneBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  weightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  surchargeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  surchargeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  surchargeLabel: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    color: '#92400e',
    letterSpacing: -0.1,
  },
  surchargeHint: {
    fontSize: 11,
    fontFamily: Fonts.spaceRegular,
    color: '#a16207',
    marginTop: 1,
  },
  surchargeAmount: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    color: '#b45309',
    letterSpacing: -0.3,
  },
  weightIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  weightLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.spaceMedium,
    color: '#92400e',
    letterSpacing: 0.1,
  },
  weightValue: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    color: '#ff8c00',
    letterSpacing: -0.3,
  },
  itemWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemWeightText: {
    fontSize: 11,
    fontFamily: Fonts.spaceMedium,
    color: '#9ca3af',
  },
  itemWeightUnit: {
    fontSize: 10,
    fontFamily: Fonts.spaceRegular,
    color: '#c4c9d4',
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
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  returnPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  returnPolicyBtnText: {
    fontSize: 10,
    fontFamily: Fonts.spaceSemiBold,
    color: '#059669',
    letterSpacing: 0.1,
  },
  rpOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rpBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  rpSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 0,
    maxHeight: '75%',
  },
  rpHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  rpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  rpIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  rpTitle: {
    fontSize: 17,
    fontFamily: Fonts.spaceBold,
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  rpProductName: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    color: '#64748b',
    marginTop: 1,
  },
  rpCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f8f9fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpBody: {
    marginBottom: 16,
  },
  rpNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  rpNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    color: '#1d4ed8',
    lineHeight: 18,
  },
  rpPolicyText: {
    fontSize: 14,
    fontFamily: Fonts.spaceRegular,
    color: '#334155',
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  rpFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 4,
  },
  rpFooterNoteText: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    color: '#94a3b8',
    flex: 1,
    lineHeight: 17,
  },
  rpDoneBtn: {
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  rpDoneBtnText: {
    fontSize: 15,
    fontFamily: Fonts.spaceBold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
