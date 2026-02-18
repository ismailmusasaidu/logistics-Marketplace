import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import { SlidersHorizontal, ArrowUpDown, X, Check, ChevronDown } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

export type SortOption =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'
  | 'name_asc';

export interface FilterState {
  sort: SortOption;
  minPrice: string;
  maxPrice: string;
  inStockOnly: boolean;
  onSaleOnly: boolean;
  minRating: number | null;
}

export const DEFAULT_FILTERS: FilterState = {
  sort: 'newest',
  minPrice: '',
  maxPrice: '',
  inStockOnly: true,
  onSaleOnly: false,
  minRating: null,
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating_desc', label: 'Best Rated' },
  { value: 'name_asc', label: 'Name: A to Z' },
];

const RATING_OPTIONS = [4, 3, 2];

interface Props {
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  resultCount: number;
}

export default function FilterSortPanel({ filters, onApply, resultCount }: Props) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<FilterState>(filters);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const activeFilterCount = [
    filters.sort !== 'newest',
    filters.minPrice !== '',
    filters.maxPrice !== '',
    !filters.inStockOnly,
    filters.onSaleOnly,
    filters.minRating !== null,
  ].filter(Boolean).length;

  const handleApply = () => {
    onApply(draft);
    setVisible(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? 'Sort';

  return (
    <>
      <View style={styles.barRow}>
        <TouchableOpacity
          style={[styles.barButton, activeFilterCount > 0 && styles.barButtonActive]}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <SlidersHorizontal size={16} color={activeFilterCount > 0 ? '#fff' : '#444'} strokeWidth={2} />
          <Text style={[styles.barButtonText, activeFilterCount > 0 && styles.barButtonTextActive]}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
          {activeFilterCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.barButton, filters.sort !== 'newest' && styles.barButtonActive]}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <ArrowUpDown size={16} color={filters.sort !== 'newest' ? '#fff' : '#444'} strokeWidth={2} />
          <Text
            style={[styles.barButtonText, filters.sort !== 'newest' && styles.barButtonTextActive]}
            numberOfLines={1}
          >
            {filters.sort !== 'newest' ? currentSortLabel : 'Sort'}
          </Text>
          <ChevronDown size={14} color={filters.sort !== 'newest' ? '#fff' : '#888'} />
        </TouchableOpacity>

        <View style={styles.resultBadge}>
          <Text style={styles.resultText}>{resultCount} item{resultCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <Modal visible={visible} transparent animationType="none" onRequestClose={() => setVisible(false)}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter & Sort</Text>
            <View style={styles.sheetHeaderRight}>
              <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                <Text style={styles.resetText}>Reset all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#333" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <Section title="Sort By">
              <View style={styles.sortGrid}>
                {SORT_OPTIONS.map((opt) => {
                  const active = draft.sort === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.sortChip, active && styles.sortChipActive]}
                      onPress={() => setDraft((d) => ({ ...d, sort: opt.value }))}
                      activeOpacity={0.8}
                    >
                      {active && <Check size={13} color="#fff" strokeWidth={3} />}
                      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <Divider />

            <Section title="Price Range">
              <View style={styles.priceRow}>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.priceLabel}>Min (₦)</Text>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    value={draft.minPrice}
                    onChangeText={(v) => setDraft((d) => ({ ...d, minPrice: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
                <View style={styles.priceDash} />
                <View style={styles.priceInputWrap}>
                  <Text style={styles.priceLabel}>Max (₦)</Text>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    placeholder="Any"
                    placeholderTextColor="#bbb"
                    value={draft.maxPrice}
                    onChangeText={(v) => setDraft((d) => ({ ...d, maxPrice: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
              </View>
            </Section>

            <Divider />

            <Section title="Availability & Deals">
              <ToggleRow
                label="In Stock Only"
                sublabel="Hide out-of-stock products"
                value={draft.inStockOnly}
                onToggle={() => setDraft((d) => ({ ...d, inStockOnly: !d.inStockOnly }))}
              />
              <ToggleRow
                label="On Sale"
                sublabel="Show discounted products only"
                value={draft.onSaleOnly}
                onToggle={() => setDraft((d) => ({ ...d, onSaleOnly: !d.onSaleOnly }))}
              />
            </Section>

            <Divider />

            <Section title="Minimum Rating">
              <View style={styles.ratingRow}>
                <TouchableOpacity
                  style={[styles.ratingChip, draft.minRating === null && styles.ratingChipActive]}
                  onPress={() => setDraft((d) => ({ ...d, minRating: null }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.ratingChipText, draft.minRating === null && styles.ratingChipTextActive]}>
                    Any
                  </Text>
                </TouchableOpacity>
                {RATING_OPTIONS.map((r) => {
                  const active = draft.minRating === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.ratingChip, active && styles.ratingChipActive]}
                      onPress={() => setDraft((d) => ({ ...d, minRating: r }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.ratingChipText, active && styles.ratingChipTextActive]}>
                        {r}+ ★
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.applyWrap}>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
              <Text style={styles.applyText}>Show Results</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ToggleRow({
  label,
  sublabel,
  value,
  onToggle,
}: {
  label: string;
  sublabel: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSublabel}>{sublabel}</Text>
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece8',
  },
  barButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f4f1ee',
    borderWidth: 1.5,
    borderColor: '#e8e4e0',
  },
  barButtonActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  barButtonText: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    color: '#444',
  },
  barButtonTextActive: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.spaceBold,
    color: '#ff8c00',
  },
  resultBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fdf3e7',
  },
  resultText: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    color: '#ff8c00',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0dbd4',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ede8',
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  sheetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff3e8',
  },
  resetText: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    color: '#ff8c00',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f4f1ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetBody: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    color: '#888',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3ede8',
    marginHorizontal: 20,
  },
  sortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f4f1ee',
    borderWidth: 1.5,
    borderColor: '#e8e4df',
  },
  sortChipActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  sortChipText: {
    fontSize: 13,
    fontFamily: Fonts.spaceSemiBold,
    color: '#555',
  },
  sortChipTextActive: {
    color: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrap: {
    flex: 1,
    gap: 6,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: Fonts.spaceMedium,
    color: '#999',
  },
  priceInput: {
    borderWidth: 1.5,
    borderColor: '#e8e4df',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: Fonts.spaceRegular,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  priceDash: {
    width: 20,
    height: 2,
    backgroundColor: '#ddd',
    borderRadius: 1,
    marginTop: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1a1a1a',
  },
  toggleSublabel: {
    fontSize: 12,
    fontFamily: Fonts.spaceRegular,
    color: '#999',
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e0dbd4',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#ff8c00',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f4f1ee',
    borderWidth: 1.5,
    borderColor: '#e8e4df',
  },
  ratingChipActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  ratingChipText: {
    fontSize: 14,
    fontFamily: Fonts.spaceSemiBold,
    color: '#555',
  },
  ratingChipTextActive: {
    color: '#fff',
  },
  applyWrap: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#f3ede8',
  },
  applyBtn: {
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  applyText: {
    fontSize: 16,
    fontFamily: Fonts.spaceBold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
