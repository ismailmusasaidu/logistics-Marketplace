import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Animated,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Store, MapPin, Package, X, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/marketplace/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';
import VendorStorePage from '@/components/marketplace/VendorStorePage';

const PAGE_SIZE = 12;

interface VendorItem {
  id: string;
  business_name: string;
  business_description?: string;
  avatar_url?: string;
  business_address?: string;
  product_count?: number;
}

interface VendorCardProps {
  item: VendorItem;
  colors: any;
  fadeAnim: Animated.Value;
  onPress: (vendor: VendorItem) => void;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();

const VendorCard = memo(({ item, colors, fadeAnim, onPress }: VendorCardProps) => {
  const initials = getInitials(item.business_name);
  const productCount = item.product_count || 0;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
        onPress={() => onPress(item)}
        activeOpacity={0.88}
      >
        <View style={styles.cardTop}>
          <View style={styles.avatarWrap}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
            ) : (
              <LinearGradient colors={['#f97316', '#ea580c']} style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
            <View style={[styles.activeDot, { backgroundColor: '#22c55e', borderColor: colors.surface }]} />
          </View>

          <View style={styles.cardInfo}>
            <Text style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
              {item.business_name}
            </Text>
            {item.business_description ? (
              <Text style={[styles.vendorDesc, { color: colors.textMuted }]} numberOfLines={2}>
                {item.business_description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              {item.business_address ? (
                <View style={styles.metaItem}>
                  <MapPin size={11} color={colors.textMuted} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.business_address}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

        <View style={styles.cardBottom}>
          <View style={styles.statItem}>
            <Package size={13} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.statValue, { color: colors.text }]}>{productCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>products</Text>
          </View>
          <View style={[styles.visitBtn, { backgroundColor: colors.primaryLight + '18', borderColor: colors.primary + '44' }]}>
            <Store size={12} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.visitLabel, { color: colors.primary }]}>Visit</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function VendorListTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const [filterVisible, setFilterVisible] = useState(false);
  const [addressFilter, setAddressFilter] = useState('');
  const [appliedAddress, setAppliedAddress] = useState('');

  const [storeVisible, setStoreVisible] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

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
    setVendors([]);
    setPage(0);
    setHasMore(true);
    setLoading(true);
    fetchVendors(0, true, searchDebounced, appliedAddress);
  }, [searchDebounced, appliedAddress]);

  const fetchVendors = async (
    pageNum: number,
    reset: boolean,
    search: string,
    address: string,
  ) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('profiles')
        .select('id, business_name, business_description, avatar_url, business_address', { count: 'exact' })
        .eq('role', 'vendor')
        .eq('vendor_status', 'approved')
        .not('business_name', 'is', null);

      if (search.trim()) {
        query = query.ilike('business_name', `%${search.trim()}%`);
      }

      if (address.trim()) {
        query = query.ilike('business_address', `%${address.trim()}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const vendorList: VendorItem[] = (data || []).map((p) => ({
        id: p.id,
        business_name: p.business_name,
        business_description: p.business_description,
        avatar_url: p.avatar_url,
        business_address: p.business_address,
        product_count: 0,
      }));

      if (vendorList.length > 0) {
        const profileIds = vendorList.map((v) => v.id);
        const { data: productCounts } = await supabase
          .from('products')
          .select('vendor_id')
          .in('vendor_id', profileIds)
          .eq('is_available', true);

        const countMap: Record<string, number> = {};
        (productCounts || []).forEach((p) => {
          countMap[p.vendor_id] = (countMap[p.vendor_id] || 0) + 1;
        });

        vendorList.forEach((v) => {
          v.product_count = countMap[v.id] || 0;
        });
      }

      if (reset) {
        setVendors(vendorList);
      } else {
        setVendors((prev) => [...prev, ...vendorList]);
      }

      setTotalCount(count || 0);
      setHasMore(vendorList.length === PAGE_SIZE && (count ? from + PAGE_SIZE < count : true));
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchVendors(next, false, searchDebounced, appliedAddress);
    }
  };

  const applyFilters = () => {
    setAppliedAddress(addressFilter);
    setFilterVisible(false);
  };

  const clearFilters = () => {
    setAddressFilter('');
    setAppliedAddress('');
    setFilterVisible(false);
  };

  const hasActiveFilters = appliedAddress !== '';

  const openStore = useCallback((vendor: VendorItem) => {
    setSelectedVendorId(vendor.id);
    setSelectedVendorName(vendor.business_name);
    setStoreVisible(true);
  }, []);

  const renderVendorCard = useCallback(({ item }: { item: VendorItem }) => (
    <VendorCard item={item} colors={colors} fadeAnim={fadeAnim} onPress={openStore} />
  ), [colors, fadeAnim, openStore]);

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

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>Marketplace</Text>
            <Text style={styles.headerTitle}>Browse Stores</Text>
          </View>
          <View style={styles.headerIconCircle}>
            <Store size={20} color="#f97316" strokeWidth={2} />
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1 }]}>
            <Search size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search stores..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              hasActiveFilters && styles.filterBtnActive,
            ]}
            onPress={() => {
              setAddressFilter(appliedAddress);
              setFilterVisible(true);
            }}
          >
            <SlidersHorizontal size={16} color={hasActiveFilters ? '#f97316' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {hasActiveFilters && (
          <View style={styles.activePills}>
            <View style={styles.activePill}>
              <MapPin size={10} color="#f97316" strokeWidth={2} />
              <Text style={styles.activePillText}>{appliedAddress}</Text>
              <TouchableOpacity
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => setAppliedAddress('')}
              >
                <X size={10} color="#f97316" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!loading && (
          <Text style={styles.resultCount}>
            {totalCount} {totalCount === 1 ? 'store' : 'stores'}{hasActiveFilters ? ' matched' : ' available'}
          </Text>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading stores...</Text>
        </View>
      ) : vendors.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryLight + '18' }]}>
            <Store size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery || hasActiveFilters ? 'No stores found' : 'No stores yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Vendors will appear here once approved.'}
          </Text>
          {(searchQuery || hasActiveFilters) ? (
            <TouchableOpacity
              style={[styles.clearBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setSearchQuery(''); clearFilters(); }}
            >
              <Text style={styles.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={renderVendorCard}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.footerText, { color: colors.textMuted }]}>Loading more stores...</Text>
              </View>
            ) : hasMore ? null : vendors.length > PAGE_SIZE ? (
              <Text style={[styles.endText, { color: colors.textMuted }]}>All stores loaded</Text>
            ) : null
          }
        />
      )}

      <VendorStorePage
        visible={storeVisible}
        vendorId={selectedVendorId}
        vendorName={selectedVendorName}
        onClose={() => {
          setStoreVisible(false);
          setSelectedVendorId(null);
        }}
      />

      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterVisible(false)} />
          <View style={[styles.filterSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.filterSheetHandle, { backgroundColor: colors.borderLight }]} />

            <View style={styles.filterSheetHeader}>
              <Text style={[styles.filterSheetTitle, { color: colors.text }]}>Filter Stores</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <X size={20} color={colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterBody}>
              <Text style={[styles.filterSectionLabel, { color: colors.textMuted }]}>FILTER BY LOCATION</Text>
              <Text style={[styles.filterSectionHint, { color: colors.textMuted }]}>
                Enter a city, area, or neighbourhood name to find stores near you
              </Text>
              <View style={[styles.addressInput, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
                <MapPin size={15} color={colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={[styles.addressInputText, { color: colors.text }]}
                  value={addressFilter}
                  onChangeText={setAddressFilter}
                  placeholder="e.g. Kano, Abuja, Victoria Island..."
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                {addressFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setAddressFilter('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={14} color={colors.textMuted} strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={[styles.filterActions, { borderTopColor: colors.borderLight }]}>
              <TouchableOpacity
                style={[styles.filterClearBtn, { borderColor: colors.borderLight }]}
                onPress={clearFilters}
              >
                <Text style={[styles.filterClearText, { color: colors.textMuted }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={applyFilters}
              >
                <Text style={styles.filterApplyText}>Apply filters</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
    gap: 14,
  },
  decorBlob1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(249,115,22,0.1)',
    top: -70,
    right: -50,
  },
  decorBlob2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(249,115,22,0.06)',
    bottom: -40,
    left: -30,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#ffffff',
    padding: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  activePills: {
    marginTop: -6,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  activePillText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#f97316',
  },
  resultCount: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
    marginTop: -6,
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
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  clearBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  activeDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    bottom: 1,
    right: 1,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  vendorName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    letterSpacing: -0.1,
  },
  vendorDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  metaText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    flex: 1,
  },
  cardDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 0,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
  visitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  visitLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  endText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.medium,
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  filterSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterSheetTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
  },
  filterBody: {
    paddingHorizontal: 20,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1,
    marginBottom: 12,
  },
  filterSectionHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginBottom: 10,
    marginTop: -8,
  },
  addressInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  addressInputText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    padding: 0,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  filterClearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterClearText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
