import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ShoppingBag, SlidersHorizontal } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/marketplace/supabase';
import { Product, Category, Advert } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import ProductDetailModal from '@/components/marketplace/ProductDetailModal';
import ProductCard from '@/components/marketplace/ProductCard';
import AdModal from '@/components/marketplace/AdModal';
import PromoBannerSlider from '@/components/marketplace/PromoBannerSlider';
import FilterSortPanel, { FilterState, DEFAULT_FILTERS } from '@/components/marketplace/FilterSortPanel';
import SearchAutocomplete from '@/components/marketplace/SearchAutocomplete';
import EmptyState from '@/components/EmptyState';
import OfflineBanner from '@/components/OfflineBanner';
import VendorLeaderboard from '@/components/marketplace/VendorLeaderboard';
import VendorStorePage from '@/components/marketplace/VendorStorePage';
const FILTERS_STORAGE_KEY = 'marketplace_filters';
const CATEGORY_STORAGE_KEY = 'marketplace_selected_category';
import { Fonts } from '@/constants/fonts';

const PAGE_SIZE = 16;

export default function CustomerHome() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentAdvert, setCurrentAdvert] = useState<Advert | null>(null);
  const [filtersRestored, setFiltersRestored] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isProductsStale, setIsProductsStale] = useState(false);
  const [vendorStoreVisible, setVendorStoreVisible] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const restoreFilters = async () => {
    try {
      const [savedFilters, savedCategory] = await Promise.all([
        AsyncStorage.getItem(FILTERS_STORAGE_KEY),
        AsyncStorage.getItem(CATEGORY_STORAGE_KEY),
      ]);
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters) as FilterState;
        setFilters(parsed);
      }
      if (savedCategory !== null) {
        setSelectedCategory(savedCategory === '' ? null : savedCategory);
      }
    } catch {
    } finally {
      setFiltersRestored(true);
    }
  };

  useEffect(() => {
    restoreFilters();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    fetchCategories();
    checkAndShowAdvert();

    const subscription = supabase
      .channel('products_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts((prev) =>
          prev.map((product) =>
            product.id === payload.new.id ? (payload.new as Product) : product
          )
        );
      })
      .subscribe();

    if (!filtersRestored) return;
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters)).catch(() => {});
    AsyncStorage.setItem(CATEGORY_STORAGE_KEY, selectedCategory ?? '').catch(() => {});
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!filtersRestored) return;
    setProducts([]);
    setPage(0);
    setHasMore(true);
    setIsProductsStale(false);
    fetchProducts(0, true);
  }, [selectedCategory, filters, filtersRestored]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async (pageNum: number = 0, reset: boolean = false) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from('products').select('*', { count: 'exact' });

      if (filters.inStockOnly) {
        query = query.eq('is_available', true).gt('stock_quantity', 0);
      } else {
        query = query.eq('is_available', true);
      }

      if (selectedCategory) query = query.eq('category_id', selectedCategory);
      if (filters.minPrice !== '') query = query.gte('price', parseFloat(filters.minPrice));
      if (filters.maxPrice !== '') query = query.lte('price', parseFloat(filters.maxPrice));
      if (filters.onSaleOnly) query = query.gt('discount_percentage', 0);
      if (filters.minRating !== null) query = query.gte('rating', filters.minRating);

      switch (filters.sort) {
        case 'price_asc': query = query.order('price', { ascending: true }); break;
        case 'price_desc': query = query.order('price', { ascending: false }); break;
        case 'rating_desc': query = query.order('rating', { ascending: false }); break;
        case 'name_asc': query = query.order('name', { ascending: true }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const newProducts = data || [];
      if (reset) {
        setProducts(newProducts);
        const cacheKey = `cache_products_${selectedCategory || 'all'}`;
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: newProducts, timestamp: Date.now() }));
        } catch {}
      } else {
        setProducts((prev) => [...prev, ...newProducts]);
      }

      setHasMore(newProducts.length === PAGE_SIZE && (count ? (from + PAGE_SIZE) < count : true));
      setIsProductsStale(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      if (reset) {
        const cacheKey = `cache_products_${selectedCategory || 'all'}`;
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const raw = await AsyncStorage.getItem(cacheKey);
          if (raw) {
            const cached = JSON.parse(raw);
            setProducts(cached.data || []);
            setIsProductsStale(true);
          }
        } catch {}
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const checkAndShowAdvert = async () => {
    try {
      const { data: adverts, error } = await supabase
        .from('adverts')
        .select('*')
        .eq('is_active', true)
        .or('display_position.eq.modal,display_position.eq.both,display_position.is.null')
        .order('priority', { ascending: false });
      if (error || !adverts || adverts.length === 0) return;
      const advert = adverts[0] as Advert;
      const shouldShow = await shouldShowAdvert(advert);
      if (shouldShow) {
        setCurrentAdvert(advert);
        setTimeout(() => { setShowAdModal(true); }, 1000);
        await markAdvertAsShown(advert);
      }
    } catch (error) {
      console.error('Error checking adverts:', error);
    }
  };

  const shouldShowAdvert = async (advert: Advert): Promise<boolean> => {
    const storageKey = `advert_shown_${advert.id}`;
    if (advert.display_frequency === 'always') return true;
    const lastShownStr = await AsyncStorage.getItem(storageKey);
    if (!lastShownStr && advert.display_frequency === 'once') return true;
    if (advert.display_frequency === 'daily' && lastShownStr) {
      const lastShown = new Date(lastShownStr);
      const now = new Date();
      const hoursSinceShown = (now.getTime() - lastShown.getTime()) / (1000 * 60 * 60);
      return hoursSinceShown >= 24;
    }
    if (!lastShownStr && advert.display_frequency === 'daily') return true;
    return false;
  };

  const markAdvertAsShown = async (advert: Advert) => {
    await AsyncStorage.setItem(`advert_shown_${advert.id}`, new Date().toISOString());
  };

  const closeAdModal = () => { setShowAdModal(false); setCurrentAdvert(null); };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const closeProductDetail = () => { setModalVisible(false); setSelectedProduct(null); };

  const addToCart = async (productId: string, e?: any) => {
    if (e) e.stopPropagation();
    if (!profile) return;
    try {
      const { data: existingItem } = await supabase
        .from('carts').select('id, quantity')
        .eq('user_id', profile.id).eq('product_id', productId).maybeSingle();
      if (existingItem) {
        const { error } = await supabase.from('carts')
          .update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carts')
          .upsert(
            { user_id: profile.id, product_id: productId, quantity: 1 },
            { onConflict: 'user_id,product_id', ignoreDuplicates: false }
          );
        if (error) throw error;
      }
      cartEvents.emit();
    } catch (error: any) {
      console.error('Error adding to cart:', error);
    }
  };

  const loadMoreProducts = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage, false);
    }
  };

  const handleApplyFilters = (newFilters: FilterState) => { setFilters(newFilters); };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#1a1a1a', '#2d1a00', '#3d2200']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.decorBlob1} />
        <View style={styles.decorBlob2} />
        <View style={styles.decorBlob3} />

        <Animated.View style={[styles.headerInner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.topRow}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greetingEyebrow}>Good to see you</Text>
              <Text style={styles.greetingName}>Hi, {firstName} 👋</Text>
            </View>
            <View style={styles.headerIconCircle}>
              <ShoppingBag size={20} color="#f97316" strokeWidth={2} />
            </View>
          </View>

          <View style={styles.searchBarWrap}>
            <SearchAutocomplete
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={(q) => setSearchQuery(q)}
              placeholder="Search products, vendors..."
            />
          </View>
        </Animated.View>
      </LinearGradient>



      <View style={[styles.categorySection, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, !selectedCategory && { backgroundColor: colors.primaryLight + '22', borderColor: colors.primary }]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.75}
          >
            {!selectedCategory && <View style={[styles.chipDot, { backgroundColor: colors.primary }]} />}
            <Text style={[styles.chipText, { color: colors.textSecondary }, !selectedCategory && { color: colors.primary }]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, selectedCategory === cat.id && { backgroundColor: colors.primaryLight + '22', borderColor: colors.primary }]}
              onPress={() => setSelectedCategory(cat.id)}
              activeOpacity={0.75}
            >
              {selectedCategory === cat.id && <View style={[styles.chipDot, { backgroundColor: colors.primary }]} />}
              <Text style={[styles.chipText, { color: colors.textSecondary }, selectedCategory === cat.id && { color: colors.primary }]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FilterSortPanel
        filters={filters}
        onApply={handleApplyFilters}
        resultCount={filteredProducts.length}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading products...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyBox}>
          <EmptyState
            variant={searchQuery ? 'search' : 'products'}
            title={searchQuery ? 'No results found' : 'No products yet'}
            subtitle={searchQuery ? `No products match "${searchQuery}". Try a different search.` : 'Check back later for new arrivals.'}
            actionLabel={searchQuery ? 'Clear search' : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
            size="small"
          />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[styles.productGrid, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View>
              <View style={styles.bannerSection}>
                <PromoBannerSlider />
              </View>
              <VendorLeaderboard
                onVendorPress={(vendorId, name) => {
                  setSelectedVendorId(vendorId);
                  setSelectedVendorName(name);
                  setVendorStoreVisible(true);
                }}
              />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.footerLoaderText, { color: colors.textMuted }]}>Loading more...</Text>
              </View>
            ) : <View style={{ height: 24 }} />
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ProductCard
                product={item}
                onPress={() => openProductDetail(item)}
                onAddToCart={(e) => addToCart(item.id, e)}
              />
            </View>
          )}
        />
      )}

      <ProductDetailModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={closeProductDetail}
      />

      <AdModal
        visible={showAdModal}
        advert={currentAdvert}
        onClose={closeAdModal}
      />

      <VendorStorePage
        visible={vendorStoreVisible}
        vendorId={selectedVendorId}
        vendorName={selectedVendorName}
        onClose={() => {
          setVendorStoreVisible(false);
          setSelectedVendorId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  decorBlob1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(249,115,22,0.1)',
    top: -80,
    right: -60,
  },
  decorBlob2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(249,115,22,0.06)',
    bottom: -40,
    left: -30,
  },
  decorBlob3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: 20,
    left: '45%',
  },
  headerInner: {
    position: 'relative',
    zIndex: 1,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingBlock: {
    gap: 2,
  },
  greetingEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  greetingName: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarWrap: {
    zIndex: 200,
  },
  categorySection: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#ebebeb',
  },
  chipActive: {
    backgroundColor: '#fff5ee',
    borderColor: '#f97316',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
  },
  chipText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b6b6b',
  },
  chipTextActive: {
    color: '#f97316',
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
    color: '#aaa',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff5ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  bannerSection: {
    marginBottom: 4,
  },
  productGrid: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  cardWrap: {
    flex: 1,
    maxWidth: '50%',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#aaa',
  },
});
