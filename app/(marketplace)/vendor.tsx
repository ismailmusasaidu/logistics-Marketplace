import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Package, Edit, Trash2, Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Vendor } from '@/types/database';
import StoreSetup from '@/components/marketplace/vendor/StoreSetup';
import AddProduct from '@/components/marketplace/vendor/AddProduct';
import EditProduct from '@/components/marketplace/vendor/EditProduct';
import { Fonts } from '@/constants/fonts';

export default function VendorScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loadingVendorData, setLoadingVendorData] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'recent'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (profile) {
      checkSetupStatus();
    }
  }, [profile]);

  const checkSetupStatus = async () => {
    if (!profile) return;

    try {
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (vendorData) {
        const { data: settingsData } = await supabase
          .from('vendor_settings')
          .select('is_setup_complete')
          .eq('vendor_id', vendorData.id)
          .maybeSingle();

        if (settingsData?.is_setup_complete) {
          setIsSetupComplete(true);
          fetchVendorInfo();
          fetchProducts();
        }
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorInfo = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      setVendor(data);
    } catch (error) {
      console.error('Error fetching vendor info:', error);
    }
  };

  const fetchProducts = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSetupComplete = async () => {
    setIsSetupComplete(true);
    setLoadingVendorData(true);
    await fetchVendorInfo();
    await fetchProducts();
    setLoadingVendorData(false);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { data: orderItems, error: orderCheckError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (orderCheckError) throw orderCheckError;

      if (orderItems && orderItems.length > 0) {
        Alert.alert(
          'Cannot Delete Product',
          'This product cannot be deleted because it has been included in customer orders. You can mark it as inactive instead.',
          [{ text: 'OK' }]
        );
        return;
      }

      const { count: cartCount } = await supabase
        .from('carts')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId);

      const warningMessage = cartCount && cartCount > 0
        ? `This product is in ${cartCount} customer cart(s). Deleting it will remove it from their carts. Are you sure?`
        : 'Are you sure you want to delete this product? This action cannot be undone.';

      Alert.alert(
        'Delete Product',
        warningMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await supabase
                  .from('product_images')
                  .delete()
                  .eq('product_id', productId);

                const { error: deleteError } = await supabase
                  .from('products')
                  .delete()
                  .eq('id', productId);

                if (deleteError) throw deleteError;

                Alert.alert('Success', 'Product deleted successfully');
                fetchProducts();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to delete product');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to check product dependencies');
    }
  };

  if (loading || loadingVendorData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!isSetupComplete) {
    return <StoreSetup onComplete={handleSetupComplete} />;
  }

  if (showAddProduct) {
    return (
      <AddProduct
        onBack={() => setShowAddProduct(false)}
        onSuccess={() => {
          setShowAddProduct(false);
          fetchProducts();
        }}
      />
    );
  }

  if (editingProduct) {
    return (
      <EditProduct
        product={editingProduct}
        onBack={() => setEditingProduct(null)}
        onSuccess={() => {
          setEditingProduct(null);
          fetchProducts();
        }}
      />
    );
  }

  if (!vendor) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>My Store</Text>
          <Text style={styles.subtitle}>Loading...</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Package size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>Loading store information...</Text>
        </View>
      </View>
    );
  }

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.price.toString().includes(searchQuery);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && product.is_available) ||
        (filterStatus === 'inactive' && !product.is_available);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return a.price - b.price;
        case 'stock':
          return b.stock_quantity - a.stock_quantity;
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const activeCount = products.filter(p => p.is_available).length;
  const inactiveCount = products.filter(p => !p.is_available).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{vendor.business_name}</Text>
            <Text style={styles.subtitle}>{products.length} product{products.length !== 1 ? 's' : ''} in catalog</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddProduct(true)}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Search products..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
            blurOnSubmit={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={18} color={showFilters ? '#ffffff' : '#ff8c00'} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterRow}>
              {[
                { key: 'all' as const, label: `All (${products.length})` },
                { key: 'active' as const, label: `Active (${activeCount})` },
                { key: 'inactive' as const, label: `Inactive (${inactiveCount})` },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.filterChip, filterStatus === item.key && styles.filterChipActive]}
                  onPress={() => setFilterStatus(item.key)}
                >
                  <Text style={[styles.filterChipText, filterStatus === item.key && styles.filterChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Sort by</Text>
            <View style={styles.filterRow}>
              {[
                { key: 'recent' as const, label: 'Recent' },
                { key: 'name' as const, label: 'Name' },
                { key: 'price' as const, label: 'Price' },
                { key: 'stock' as const, label: 'Stock' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.filterChip, sortBy === item.key && styles.filterChipActive]}
                  onPress={() => setSortBy(item.key)}
                >
                  <Text style={[styles.filterChipText, sortBy === item.key && styles.filterChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {(searchQuery.length > 0 || filterStatus !== 'all' || sortBy !== 'recent') && (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
            {searchQuery ? ` for "${searchQuery}"` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => { setFilterStatus('all'); setSortBy('recent'); setSearchQuery(''); }}
            style={styles.resetBtn}
          >
            <Text style={styles.resetText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Package size={40} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery.length > 0 ? 'No matches found' : 'No products yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery.length > 0
                ? 'Try adjusting your search or filters'
                : 'Tap the + button to add your first product'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => setEditingProduct(item)}
            activeOpacity={0.7}
          >
            <Image
              source={{
                uri: item.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
              }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.productPrice}>
                {'\u20A6'}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <View style={styles.productMeta}>
                <View style={[styles.stockBadge, item.stock_quantity > 10 ? styles.stockGood : styles.stockLow]}>
                  <Text style={[styles.stockText, item.stock_quantity > 10 ? styles.stockTextGood : styles.stockTextLow]}>
                    {item.stock_quantity} in stock
                  </Text>
                </View>
                <View style={[styles.statusDot, item.is_available ? styles.dotActive : styles.dotInactive]} />
                <Text style={[styles.statusLabel, item.is_available ? styles.labelActive : styles.labelInactive]}>
                  {item.is_available ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.cardAction}
                onPress={() => setEditingProduct(item)}
                activeOpacity={0.7}
              >
                <Edit size={16} color="#ff8c00" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardAction}
                onPress={() => handleDeleteProduct(item.id)}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
  },
  header: {
    backgroundColor: '#2d1f12',
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.dmSansBold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
    marginTop: 3,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ff8c00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.dmSans,
    color: '#0f1f1c',
    marginLeft: 10,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  filtersPanel: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterSection: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8f5f0',
  },
  filterChipActive: {
    backgroundColor: '#2d1f12',
    borderColor: '#2d1f12',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: Fonts.dmSansMedium,
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontFamily: Fonts.dmSansSemiBold,
  },
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsText: {
    fontSize: 13,
    fontFamily: Fonts.dmSansMedium,
    color: '#64748b',
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  resetText: {
    fontSize: 12,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#ff8c00',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0ebe4',
    alignItems: 'center',
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
  },
  productName: {
    fontSize: 15,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#0f1f1c',
    marginBottom: 3,
  },
  productPrice: {
    fontSize: 17,
    fontFamily: Fonts.dmSansBold,
    color: '#ff8c00',
    marginBottom: 6,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockGood: {
    backgroundColor: '#f0fdf4',
  },
  stockLow: {
    backgroundColor: '#fffbeb',
  },
  stockText: {
    fontSize: 11,
    fontFamily: Fonts.dmSansMedium,
  },
  stockTextGood: {
    color: '#16a34a',
  },
  stockTextLow: {
    color: '#d97706',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#ff8c00',
  },
  dotInactive: {
    backgroundColor: '#d1d5db',
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: Fonts.dmSansMedium,
  },
  labelActive: {
    color: '#ff8c00',
  },
  labelInactive: {
    color: '#94a3b8',
  },
  cardActions: {
    gap: 6,
  },
  cardAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f8faf9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: Fonts.dmSansSemiBold,
    color: '#334155',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.dmSans,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
