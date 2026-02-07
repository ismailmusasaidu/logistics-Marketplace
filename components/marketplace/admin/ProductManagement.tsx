import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  Package,
  ArrowLeft,
  Trash2,
  Star,
  Search,
  X,
  Store,
  Calendar,
  Tag,
  ChevronDown,
  AlertTriangle,
  Eye,
  TrendingUp,
  PackageX,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  in_stock: boolean;
  rating: number;
  review_count: number;
  vendor_id: string;
  created_at: string;
  vendor?: {
    full_name: string;
    email: string;
  };
}

interface ProductManagementProps {
  onBack?: () => void;
}

const PAGE_SIZE = 16;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterKey = 'all' | 'in_stock' | 'out_of_stock';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_stock', label: 'In Stock' },
  { key: 'out_of_stock', label: 'Out of Stock' },
];

export default function ProductManagement({ onBack }: ProductManagementProps) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [detailModal, setDetailModal] = useState<Product | null>(null);

  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    fetchProducts(0, true);

    const channel = supabase
      .channel('product-management')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          setProducts([]);
          setPage(0);
          setHasMore(true);
          fetchProducts(0, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async (pageNum: number = 0, reset: boolean = false) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('products')
        .select(`*, vendor:profiles!vendor_id(full_name, email)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newProducts = data || [];
      if (reset) setProducts(newProducts);
      else setProducts((prev) => [...prev, ...newProducts]);

      setHasMore(newProducts.length === PAGE_SIZE && (count ? (from + PAGE_SIZE) < count : true));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.vendor?.full_name || '').toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'in_stock') filtered = filtered.filter((p) => p.in_stock);
    if (activeFilter === 'out_of_stock') filtered = filtered.filter((p) => !p.in_stock);
    return filtered;
  };

  const filteredProducts = applyFilters();

  const getFilterCount = (key: FilterKey) => {
    if (key === 'all') return products.length;
    if (key === 'in_stock') return products.filter((p) => p.in_stock).length;
    return products.filter((p) => !p.in_stock).length;
  };

  const deleteProduct = async (product: Product) => {
    try {
      setActionLoading(product.id);
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) throw error;
      setDeleteModal(null);
      setProducts([]);
      setPage(0);
      setHasMore(true);
      await fetchProducts(0, true);
    } catch (error: any) {
      console.error('Error deleting product:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const loadMoreProducts = () => {
    if (!loadingMore && hasMore && searchQuery.trim() === '') {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage, false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const totalValue = products.reduce((sum, p) => sum + p.price, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const renderProduct = ({ item }: { item: Product }) => {
    const isLoading = actionLoading === item.id;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => setDetailModal(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.image_url }} style={styles.productImage} />
        <View style={styles.imageOverlay}>
          <View style={[styles.stockBadge, { backgroundColor: item.in_stock ? '#059669' : '#ef4444' }]}>
            <Text style={styles.stockBadgeText}>{item.in_stock ? 'In Stock' : 'Out of Stock'}</Text>
          </View>
        </View>

        <View style={styles.productBody}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productCategory}>{item.category}</Text>

          <View style={styles.productMetaRow}>
            <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>
            <View style={styles.ratingWrap}>
              <Star size={12} color="#fbbf24" fill="#fbbf24" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({item.review_count})</Text>
            </View>
          </View>

          {item.vendor && (
            <View style={styles.vendorRow}>
              <Store size={12} color="#8b909a" />
              <Text style={styles.vendorText} numberOfLines={1}>{item.vendor.full_name}</Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.dateRow}>
              <Calendar size={11} color="#8b909a" />
              <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={(e) => {
                e.stopPropagation();
                setDeleteModal(item);
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Trash2 size={15} color="#ef4444" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Products</Text>
            <Text style={styles.subtitle}>{products.length} total products</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Search size={18} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
                <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                    {getFilterCount(f.key)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#eef6ff' }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#dbeafe' }]}>
            <Package size={16} color="#3b82f6" />
          </View>
          <Text style={[styles.statNumber, { color: '#3b82f6' }]}>
            {products.filter((p) => p.in_stock).length}
          </Text>
          <Text style={styles.statLabel}>In Stock</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#fee2e2' }]}>
            <PackageX size={16} color="#ef4444" />
          </View>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {products.filter((p) => !p.in_stock).length}
          </Text>
          <Text style={styles.statLabel}>Out of Stock</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#dcfce7' }]}>
            <TrendingUp size={16} color="#059669" />
          </View>
          <Text style={[styles.statNumber, { color: '#059669' }]}>
            ₦{totalValue >= 1000 ? `${(totalValue / 1000).toFixed(0)}k` : totalValue.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#ff8c00" />
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            </View>
          ) : null
        }
        renderItem={renderProduct}
      />

      <Modal visible={!!deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIconWrap}>
              <AlertTriangle size={28} color="#ef4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete Product</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete "{deleteModal?.name}"? This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteModal(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => deleteModal && deleteProduct(deleteModal)}
                disabled={actionLoading === deleteModal?.id}
              >
                {actionLoading === deleteModal?.id ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setDetailModal(null)} />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            {detailModal && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: detailModal.image_url }} style={styles.detailImage} />
                <View style={styles.detailBody}>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailName}>{detailModal.name}</Text>
                    <View style={[styles.detailStockBadge, { backgroundColor: detailModal.in_stock ? '#d1fae5' : '#fee2e2' }]}>
                      <Text style={[styles.detailStockText, { color: detailModal.in_stock ? '#059669' : '#ef4444' }]}>
                        {detailModal.in_stock ? 'In Stock' : 'Out of Stock'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detailPrice}>₦{detailModal.price.toLocaleString()}</Text>
                  <Text style={styles.detailDescription}>{detailModal.description}</Text>

                  <View style={styles.detailInfoCard}>
                    <DetailRow icon={<Tag size={16} color="#ff8c00" />} label="Category" value={detailModal.category} />
                    <DetailRow icon={<Star size={16} color="#fbbf24" />} label="Rating" value={`${detailModal.rating.toFixed(1)} (${detailModal.review_count} reviews)`} />
                    {detailModal.vendor && (
                      <DetailRow icon={<Store size={16} color="#3b82f6" />} label="Vendor" value={detailModal.vendor.full_name} />
                    )}
                    <DetailRow icon={<Calendar size={16} color="#8b909a" />} label="Added" value={formatDate(detailModal.created_at)} last />
                  </View>

                  <TouchableOpacity
                    style={styles.detailDeleteBtn}
                    onPress={() => {
                      setDetailModal(null);
                      setTimeout(() => setDeleteModal(detailModal), 300);
                    }}
                  >
                    <Trash2 size={18} color="#ef4444" />
                    <Text style={styles.detailDeleteText}>Delete Product</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View style={[detailRowStyles.row, !last && detailRowStyles.rowBorder]}>
      <View style={detailRowStyles.iconWrap}>{icon}</View>
      <View style={detailRowStyles.content}>
        <Text style={detailRowStyles.label}>{label}</Text>
        <Text style={detailRowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8f9fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1a1d23',
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#ffffff',
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#ff8c00',
  },
  filterTabText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  filterCount: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontFamily: Fonts.groteskBold,
    color: 'rgba(255,255,255,0.4)',
  },
  filterCountTextActive: {
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontFamily: Fonts.groteskBold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: 12,
  },
  productCard: {
    flex: 1,
    maxWidth: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f1f5f9',
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  productBody: {
    padding: 12,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#1e293b',
  },
  productCategory: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    textTransform: 'capitalize',
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 16,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: Fonts.groteskSemiBold,
    color: '#1e293b',
  },
  reviewCount: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  vendorText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#8b909a',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  loadingMoreText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#8b909a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  confirmModal: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmDeleteBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  detailImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#f1f5f9',
  },
  detailBody: {
    padding: 20,
    gap: 12,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailName: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
    flex: 1,
  },
  detailStockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  detailStockText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  detailPrice: {
    fontSize: 24,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
  },
  detailDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#64748b',
    lineHeight: 21,
  },
  detailInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  detailDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    marginTop: 4,
  },
  detailDeleteText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
});
