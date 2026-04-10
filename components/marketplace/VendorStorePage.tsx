import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  TextInput,
} from 'react-native';
import { X, Search, ShoppingBag, Store, MapPin, Package } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import ProductCard from '@/components/marketplace/ProductCard';
import ProductDetailModal from '@/components/marketplace/ProductDetailModal';
import { Fonts } from '@/constants/fonts';

const PAGE_SIZE = 15;

interface VendorInfo {
  id: string;
  business_name: string;
  description?: string;
  logo_url?: string;
  city?: string;
  rating: number;
  total_products?: number;
}

interface VendorStorePageProps {
  visible: boolean;
  vendorId: string | null;
  vendorName: string;
  onClose: () => void;
}

export default function VendorStorePage({ visible, vendorId, vendorName, onClose }: VendorStorePageProps) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && vendorId) {
      setSearchQuery('');
      setSearchDebounced('');
      setProducts([]);
      setVendorInfo(null);
      setPage(0);
      setHasMore(true);
      setTotalCount(0);
      setLoading(true);
      fetchVendorProfile(vendorId);
      fetchProducts(vendorId, 0, '', true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, vendorId]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchDebounced(searchQuery);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!vendorId || !visible) return;
    setPage(0);
    setHasMore(true);
    setProducts([]);
    setLoading(true);
    fetchProducts(vendorId, 0, searchDebounced, true);
  }, [searchDebounced]);

  const fetchVendorProfile = async (vId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, business_name, business_description, avatar_url, business_address')
        .eq('id', vId)
        .maybeSingle();

      if (data) {
        setVendorInfo({
          id: vId,
          business_name: data.business_name || vendorName,
          description: data.business_description,
          logo_url: data.avatar_url,
          city: data.business_address,
          rating: 0,
        });
      } else {
        setVendorInfo({ id: vId, business_name: vendorName, rating: 0 });
      }
    } catch (err) {
      console.error('Error fetching vendor profile:', err);
    }
  };

  const fetchProducts = async (vId: string, pageNum: number, search: string, reset: boolean) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('vendor_id', vId)
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const list = data || [];
      if (reset) {
        setProducts(list);
      } else {
        setProducts((prev) => [...prev, ...list]);
      }

      const total = count || 0;
      setTotalCount(total);
      setHasMore(list.length === PAGE_SIZE && from + PAGE_SIZE < total);

      if (reset) {
        setVendorInfo((prev) => prev ? { ...prev, total_products: total } : prev);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !vendorId) return;
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    fetchProducts(vendorId, next, searchDebounced, false);
  }, [loadingMore, hasMore, vendorId, page, searchDebounced]);

  const addToCart = async (productId: string, e?: any) => {
    if (e) e.stopPropagation();
    if (!profile) return;
    setAddingToCart(productId);
    try {
      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', profile.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingItem) {
        await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
      } else {
        await supabase.from('carts').upsert(
          { user_id: profile.id, product_id: productId, quantity: 1 },
          { onConflict: 'user_id,product_id', ignoreDuplicates: false }
        );
      }
      cartEvents.emit();
    } catch (err) {
      console.error('Add to cart error:', err);
    } finally {
      setAddingToCart(null);
    }
  };

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <View style={styles.cardWrap}>
      <ProductCard
        product={item}
        onPress={() => {
          setSelectedProduct(item);
          setDetailVisible(true);
        }}
        onAddToCart={(e) => addToCart(item.id, e)}
      />
    </View>
  ), []);

  const initials = (vendorInfo?.business_name || vendorName || 'V')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const showEmpty = !loading && products.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={['#0f172a', '#1e293b']}
          style={[styles.header, { paddingTop: insets.top + 8 }]}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <X size={20} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>

          <Animated.View style={[styles.vendorProfile, { opacity: fadeAnim }]}>
            <View style={styles.avatarLarge}>
              {vendorInfo?.logo_url ? (
                <Image source={{ uri: vendorInfo.logo_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            <Text style={styles.vendorNameText} numberOfLines={1}>
              {vendorInfo?.business_name || vendorName}
            </Text>

            {vendorInfo?.description ? (
              <Text style={styles.vendorDesc} numberOfLines={2}>
                {vendorInfo.description}
              </Text>
            ) : null}

            <View style={styles.vendorMeta}>
              {vendorInfo?.city ? (
                <View style={styles.metaPill}>
                  <MapPin size={11} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                  <Text style={styles.metaText}>{vendorInfo.city}</Text>
                </View>
              ) : null}
              <View style={styles.metaPill}>
                <Package size={11} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                <Text style={styles.metaText}>{totalCount} products</Text>
              </View>
              <View style={styles.metaPill}>
                <Store size={11} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                <Text style={styles.metaText}>Verified Store</Text>
              </View>
            </View>
          </Animated.View>

          <View style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Search size={15} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search in this store..."
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color="rgba(255,255,255,0.5)" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading products...</Text>
          </View>
        ) : showEmpty ? (
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight + '22' }]}>
              <ShoppingBag size={32} color={colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {searchQuery ? 'No results found' : 'No products available'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {searchQuery
                ? `No products match "${searchQuery}"`
                : 'This vendor has no active products right now.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
                {products.length} of {totalCount} {totalCount === 1 ? 'product' : 'products'}
                {searchQuery ? ` matching "${searchQuery}"` : ''}
              </Text>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : !hasMore && products.length > 0 ? (
                <Text style={[styles.endLabel, { color: colors.textMuted }]}>All products loaded</Text>
              ) : null
            }
            renderItem={renderItem}
          />
        )}

        <ProductDetailModal
          visible={detailVisible}
          product={selectedProduct}
          onClose={() => {
            setDetailVisible(false);
            setSelectedProduct(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  vendorProfile: {
    alignItems: 'center',
    gap: 6,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  vendorNameText: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  vendorDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
  },
  vendorMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.65)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#ffffff',
    padding: 0,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  grid: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  row: {
    justifyContent: 'space-between',
  },
  cardWrap: {
    flex: 1,
    maxWidth: '50%',
  },
  countLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    paddingHorizontal: 4,
    paddingBottom: 8,
    paddingTop: 4,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.medium,
    paddingVertical: 16,
  },
});
