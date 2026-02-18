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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ShoppingBag } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/marketplace/supabase';
import { Product, Category } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import ProductDetailModal from '@/components/marketplace/ProductDetailModal';
import ProductCard from '@/components/marketplace/ProductCard';
import AdModal from '@/components/marketplace/AdModal';
import PromoBannerSlider from '@/components/marketplace/PromoBannerSlider';
import FilterSortPanel, { FilterState, DEFAULT_FILTERS } from '@/components/marketplace/FilterSortPanel';
import { Fonts } from '@/constants/fonts';

interface Advert {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  action_text?: string;
  action_url?: string;
  display_frequency: 'once' | 'daily' | 'always';
  priority: number;
  hot_deal_text?: string;
  featured_text?: string;
  trending_text?: string;
  limited_offer_text?: string;
}

const PAGE_SIZE = 16;

export default function CustomerHome() {
  const { profile } = useAuth();
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
  const [showAdModal, setShowAdModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    fetchCategories();
    checkAndShowAdvert();

    const subscription = supabase
      .channel('products_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          setProducts((prev) =>
            prev.map((product) =>
              product.id === payload.new.id ? (payload.new as Product) : product
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    fetchProducts(0, true);
  }, [selectedCategory, filters]);

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
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      if (filters.inStockOnly) {
        query = query.eq('is_available', true).gt('stock_quantity', 0);
      } else {
        query = query.eq('is_available', true);
      }

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }

      if (filters.minPrice !== '') {
        query = query.gte('price', parseFloat(filters.minPrice));
      }

      if (filters.maxPrice !== '') {
        query = query.lte('price', parseFloat(filters.maxPrice));
      }

      if (filters.onSaleOnly) {
        query = query.gt('discount_percentage', 0);
      }

      if (filters.minRating !== null) {
        query = query.gte('rating', filters.minRating);
      }

      switch (filters.sort) {
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          break;
        case 'rating_desc':
          query = query.order('rating', { ascending: false });
          break;
        case 'name_asc':
          query = query.order('name', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      const newProducts = data || [];

      if (reset) {
        setProducts(newProducts);
      } else {
        setProducts((prev) => [...prev, ...newProducts]);
      }

      setHasMore(newProducts.length === PAGE_SIZE && (count ? (from + PAGE_SIZE) < count : true));
    } catch (error) {
      console.error('Error fetching products:', error);
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
        .order('priority', { ascending: false });

      if (error || !adverts || adverts.length === 0) return;

      const advert = adverts[0] as Advert;
      const shouldShow = await shouldShowAdvert(advert);

      if (shouldShow) {
        setCurrentAdvert(advert);
        setTimeout(() => {
          setShowAdModal(true);
        }, 1000);
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
    const storageKey = `advert_shown_${advert.id}`;
    await AsyncStorage.setItem(storageKey, new Date().toISOString());
  };

  const closeAdModal = () => {
    setShowAdModal(false);
    setCurrentAdvert(null);
  };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const closeProductDetail = () => {
    setModalVisible(false);
    setSelectedProduct(null);
  };

  const addToCart = async (productId: string, e?: any) => {
    if (e) e.stopPropagation();
    if (!profile) return;

    try {
      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', profile.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carts')
          .insert({
            user_id: profile.id,
            product_id: productId,
            quantity: 1,
          });
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

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const firstName = profile?.full_name?.split(' ')[0] || 'Guest';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#ff9a1f', '#ff8c00', '#e67a00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <Animated.View
          style={[
            styles.headerInner,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.greetingRow}>
            <View style={styles.greetingTextWrap}>
              <Text style={styles.greeting}>Hello, {firstName}</Text>
              <Text style={styles.subtitle}>What would you like to order today?</Text>
            </View>
            <View style={styles.headerLogoIcon}>
              <ShoppingBag size={22} color="#ff8c00" strokeWidth={2.5} />
            </View>
          </View>

          <View style={[styles.searchContainer, searchFocused && styles.searchContainerFocused]}>
            <Search size={20} color={searchFocused ? '#ff8c00' : '#9ca3af'} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#b0b0b0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>
        </Animated.View>
      </LinearGradient>

      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name}
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff8c00" />
          <Text style={styles.loadingLabel}>Loading products...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingBag size={48} color="#d4d4d4" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different search term' : 'Check back later for new arrivals'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={<PromoBannerSlider />}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#ff8c00" />
                <Text style={styles.loadingText}>Loading more...</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    top: -50,
    right: -30,
  },
  decorCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -20,
    left: -20,
  },
  headerInner: {
    position: 'relative',
    zIndex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingTextWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontFamily: Fonts.spaceBold,
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  headerLogoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchContainerFocused: {
    borderColor: '#ffffff',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Fonts.spaceRegular,
    color: '#1a1a1a',
    outlineStyle: 'none',
  },
  categoriesWrapper: {
    paddingVertical: 14,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  categoryChipActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryText: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#666',
    letterSpacing: 0.1,
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: '#444',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
    textAlign: 'center',
  },
  productList: {
    padding: 12,
    paddingBottom: 32,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  cardWrapper: {
    flex: 1,
    maxWidth: '50%',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
  },
});
