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
import { Trash2, Plus, Minus, Scale, RotateCcw, X, ShieldCheck, Clock, CircleAlert as AlertCircle } from 'lucide-react-native';
import EmptyState from '@/components/EmptyState';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import { router, useFocusEffect } from 'expo-router';
import ProductDetailModal from '@/components/marketplace/ProductDetailModal';
import { Product } from '@/types/database';
import { Fonts } from '@/constants/fonts';

interface CartItemWithProduct {
  id: string;
  quantity: number;
  product_id: string;
  selected_option: string | null;
  option_price: number | null;
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
  const { colors } = useTheme();
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
          selected_option,
          option_price,
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
        selected_option: item.selected_option,
        option_price: item.option_price,
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
    return cartItems.reduce((sum, item) => {
      const unitPrice = item.option_price ?? item.product.price;
      return sum + unitPrice * item.quantity;
    }, 0);
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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <EmptyState
          variant="cart"
          title="Your cart is empty"
          subtitle="Add some products to get started."
          actionLabel="Start Shopping"
          onAction={() => router.push('/(marketplace)')}
        />
      </View>
    );
  }

  const renderCartItem = useCallback(({ item }: { item: typeof cartItems[0] }) => (
    <View style={[styles.cartItem, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleViewProduct(item.product_id)}
      >
        <Image
          source={{
            uri: item.product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
          }}
          style={[styles.itemImage, { backgroundColor: colors.surfaceSecondary }]}
        />
      </TouchableOpacity>
      <View style={styles.itemInfo}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewProduct(item.product_id)} style={styles.itemNamePressable}>
          <Text style={[styles.itemName, { color: colors.text }]}>{item.product.name}</Text>
          {item.selected_option && (
            <View style={[styles.optionBadge, { backgroundColor: colors.primaryLight ?? '#fff7ed', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.optionBadgeText, { color: colors.primary }]}>{item.selected_option}</Text>
            </View>
          )}
          <Text style={[styles.itemPrice, { color: colors.primaryDark }]}>
            ₦{(item.option_price ?? item.product.price).toFixed(2)} / {item.product.unit}
          </Text>
        </TouchableOpacity>
        {item.product.weight_kg != null && (
          <View style={styles.itemWeightRow}>
            <Scale size={11} color={colors.textMuted} strokeWidth={2} />
            <Text style={[styles.itemWeightText, { color: colors.textMuted }]}>
              {(item.product.weight_kg * item.quantity).toFixed(3)} kg
              {item.quantity > 1 && (
                <Text style={[styles.itemWeightUnit, { color: colors.textMuted }]}> ({item.product.weight_kg} kg each)</Text>
              )}
            </Text>
          </View>
        )}
        <View style={styles.itemBottomRow}>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}
              onPress={() => updateQuantity(item.id, item.quantity - 1)}
            >
              <Minus size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.quantity, { color: colors.text }]}>{item.quantity}</Text>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}
              onPress={() => updateQuantity(item.id, item.quantity + 1)}
            >
              <Plus size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {item.product.return_policy ? (
            <TouchableOpacity
              style={[styles.returnPolicyBtn, { backgroundColor: colors.successLight, borderColor: colors.success + '40' }]}
              onPress={() => setReturnPolicyProduct({ name: item.product.name, policy: item.product.return_policy! })}
            >
              <RotateCcw size={11} color={colors.success} strokeWidth={2.2} />
              <Text style={[styles.returnPolicyBtnText, { color: colors.success }]}>Return Policy</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeItem(item.id)}
      >
        <Trash2 size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  ), [colors, handleViewProduct, updateQuantity, removeItem, setReturnPolicyProduct]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: colors.primary, shadowColor: colors.primary }]}>
        <Text style={styles.title}>My Cart</Text>
        <Text style={styles.itemCount}>{cartItems.length} items</Text>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderCartItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20, backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
        {hasAnyWeight && (
          <View style={[styles.weightContainer, { backgroundColor: colors.warningLight, borderColor: colors.warning + '40' }]}>
            <View style={[styles.weightIconWrap, { backgroundColor: colors.surface, borderColor: colors.warning + '40' }]}>
              <Scale size={14} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={[styles.weightLabel, { color: colors.warning }]}>Total Weight</Text>
            <Text style={[styles.weightValue, { color: colors.primary }]}>
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
            <View style={[styles.surchargeContainer, { backgroundColor: colors.warningLight, borderColor: colors.warning + '50' }]}>
              <View style={styles.surchargeLeft}>
                <Scale size={13} color={colors.warning} strokeWidth={2} />
                <View>
                  <Text style={[styles.surchargeLabel, { color: colors.warning }]}>{surcharge.label}</Text>
                  <Text style={[styles.surchargeHint, { color: colors.textSecondary }]}>Weight-based additional charge</Text>
                </View>
              </View>
              <Text style={[styles.surchargeAmount, { color: colors.warning }]}>
                +₦{Number(surcharge.charge_amount).toFixed(2)}
              </Text>
            </View>
          );
        })()}
        <View style={styles.totalContainer}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
          <Text style={[styles.totalAmount, { color: colors.primaryDark }]}>
            ₦{(calculateTotal() + Number(getApplicableWeightSurcharge()?.charge_amount ?? 0)).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity style={[styles.checkoutButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={handleCheckout}>
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
          <View style={[styles.rpSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.rpHandle, { backgroundColor: colors.border }]} />

            <View style={styles.rpHeader}>
              <View style={styles.rpHeaderLeft}>
                <View style={[styles.rpIconWrap, { backgroundColor: colors.successLight, borderColor: colors.success + '40' }]}>
                  <ShieldCheck size={22} color={colors.success} strokeWidth={2} />
                </View>
                <View>
                  <Text style={[styles.rpTitle, { color: colors.text }]}>Return Policy</Text>
                  <Text style={[styles.rpProductName, { color: colors.textSecondary }]} numberOfLines={1}>{returnPolicyProduct?.name}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.rpCloseBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setReturnPolicyProduct(null)}>
                <X size={18} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.rpBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.rpNotice, { backgroundColor: colors.infoLight, borderColor: colors.info + '40' }]}>
                <AlertCircle size={14} color={colors.info} strokeWidth={2} />
                <Text style={[styles.rpNoticeText, { color: colors.info }]}>
                  Please read this policy carefully before making a purchase.
                </Text>
              </View>

              <Text style={[styles.rpPolicyText, { color: colors.text }]}>{returnPolicyProduct?.policy}</Text>

              <View style={[styles.rpFooterNote, { borderTopColor: colors.borderLight }]}>
                <Clock size={13} color={colors.textMuted} strokeWidth={2} />
                <Text style={[styles.rpFooterNoteText, { color: colors.textMuted }]}>
                  Contact the vendor or support team to initiate a return.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.rpDoneBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={() => setReturnPolicyProduct(null)}>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
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
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemNamePressable: {
    alignSelf: 'flex-start',
  },
  itemName: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    letterSpacing: -0.1,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  optionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 3,
    marginBottom: 1,
  },
  optionBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.spaceSemiBold,
    letterSpacing: 0.1,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  quantity: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    marginHorizontal: 10,
  },
  deleteButton: {
    justifyContent: 'center',
    padding: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  weightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  surchargeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
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
    letterSpacing: -0.1,
  },
  surchargeHint: {
    fontSize: 11,
    fontFamily: Fonts.spaceRegular,
    marginTop: 1,
  },
  surchargeAmount: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    letterSpacing: -0.3,
  },
  weightIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  weightLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.spaceMedium,
    letterSpacing: 0.1,
  },
  weightValue: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
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
  },
  itemWeightUnit: {
    fontSize: 10,
    fontFamily: Fonts.spaceRegular,
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
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  totalAmount: {
    fontSize: 24,
    fontFamily: Fonts.spaceBold,
    letterSpacing: -0.8,
  },
  checkoutButton: {
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  returnPolicyBtnText: {
    fontSize: 10,
    fontFamily: Fonts.spaceSemiBold,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rpTitle: {
    fontSize: 17,
    fontFamily: Fonts.spaceBold,
    letterSpacing: -0.3,
  },
  rpProductName: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    marginTop: 1,
  },
  rpCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  rpNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    lineHeight: 18,
  },
  rpPolicyText: {
    fontSize: 14,
    fontFamily: Fonts.spaceRegular,
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
    marginBottom: 4,
  },
  rpFooterNoteText: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    flex: 1,
    lineHeight: 17,
  },
  rpDoneBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
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
