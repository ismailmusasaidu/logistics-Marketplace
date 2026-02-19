import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Save,
  MessageSquare,
  Package,
  Tag,
  DollarSign,
  Layers,
  FileText,
  Link as LinkIcon,
  ToggleRight,
  ToggleLeft,
  Pencil,
  Percent,
  Scale,
  Ruler,
  Palette,
  RotateCcw,
  Plus,
  X,
  Truck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { Product, Category } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Fonts } from '@/constants/fonts';
import ProductReviews from '@/components/marketplace/ProductReviews';

interface EditProductProps {
  product: Product;
  onBack: () => void;
  onSuccess: () => void;
}

export default function EditProduct({ product, onBack, onSuccess }: EditProductProps) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price.toString());
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity.toString());
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [isAvailable, setIsAvailable] = useState(product.is_available);
  const [imageUrl, setImageUrl] = useState(product.image_url || '');
  const [discountPercentage, setDiscountPercentage] = useState(
    product.discount_percentage ? String(product.discount_percentage) : ''
  );
  const [discountActive, setDiscountActive] = useState(product.discount_active || false);
  const [weightKg, setWeightKg] = useState(
    product.weight_kg != null ? String(product.weight_kg) : ''
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [sizes, setSizes] = useState<string[]>(product.sizes || []);
  const [sizeInput, setSizeInput] = useState('');
  const [colors, setColors] = useState<string[]>(product.colors || []);
  const [colorInput, setColorInput] = useState('');
  const [returnPolicy, setReturnPolicy] = useState(product.return_policy || '');
  const [expectedDeliveryDays, setExpectedDeliveryDays] = useState(
    product.expected_delivery_days != null ? String(product.expected_delivery_days) : ''
  );

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const addSize = () => {
    const val = sizeInput.trim();
    if (!val) return;
    if (!sizes.includes(val)) setSizes([...sizes, val]);
    setSizeInput('');
  };

  const removeSize = (s: string) => setSizes(sizes.filter((x) => x !== s));

  const addColor = () => {
    const val = colorInput.trim();
    if (!val) return;
    if (!colors.includes(val)) setColors([...colors, val]);
    setColorInput('');
  };

  const removeColor = (c: string) => setColors(colors.filter((x) => x !== c));

  const handleUpdate = async () => {
    if (!name.trim() || !price || !stockQuantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const discountPct = parseInt(discountPercentage) || 0;
      const { error } = await supabase
        .from('products')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          price: parseFloat(price),
          stock_quantity: parseInt(stockQuantity, 10),
          category_id: categoryId,
          is_available: isAvailable,
          image_url: imageUrl.trim() || null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          discount_percentage: Math.min(Math.max(discountPct, 0), 100),
          discount_active: discountActive && discountPct > 0,
          sizes: sizes.length > 0 ? sizes : null,
          colors: colors.length > 0 ? colors : null,
          return_policy: returnPolicy.trim() || null,
          expected_delivery_days: expectedDeliveryDays ? parseInt(expectedDeliveryDays) : null,
        })
        .eq('id', product.id);

      if (error) throw error;

      Alert.alert('Success', 'Product updated successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating product:', error);
      Alert.alert('Error', error.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Edit Product</Text>
          <Text style={styles.headerSubtitle}>Update your product details</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, !showReviews && styles.tabActive]}
              onPress={() => setShowReviews(false)}
              activeOpacity={0.7}
            >
              <Pencil size={16} color={!showReviews ? '#ff8c00' : '#888'} strokeWidth={2.2} />
              <Text style={[styles.tabText, !showReviews && styles.tabTextActive]}>
                Product Details
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, showReviews && styles.tabActive]}
              onPress={() => setShowReviews(true)}
              activeOpacity={0.7}
            >
              <MessageSquare size={16} color={showReviews ? '#ff8c00' : '#888'} strokeWidth={2.2} />
              <Text style={[styles.tabText, showReviews && styles.tabTextActive]}>
                Reviews
              </Text>
            </TouchableOpacity>
          </View>

          {!showReviews ? (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <Package size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Basic Information</Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Tag size={14} color="#888" />
                    <Text style={styles.label}>Product Name</Text>
                    <Text style={styles.required}>*</Text>
                  </View>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="Enter product name"
                    placeholderTextColor="#b0b0b0"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <FileText size={14} color="#888" />
                    <Text style={styles.label}>Description</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="Enter product description"
                    placeholderTextColor="#b0b0b0"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <View style={styles.labelRow}>
                      <DollarSign size={14} color="#888" />
                      <Text style={styles.label}>Price</Text>
                      <Text style={styles.required}>*</Text>
                    </View>
                    <View style={styles.inputWithPrefix}>
                      <Text style={styles.prefixText}>{'\u20A6'}</Text>
                      <TextInput
                        style={[styles.input, styles.prefixInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                        placeholder="0.00"
                        placeholderTextColor="#b0b0b0"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <View style={styles.labelRow}>
                      <Layers size={14} color="#888" />
                      <Text style={styles.label}>Stock</Text>
                      <Text style={styles.required}>*</Text>
                    </View>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder="0"
                      placeholderTextColor="#b0b0b0"
                      value={stockQuantity}
                      onChangeText={setStockQuantity}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Scale size={14} color="#888" />
                    <Text style={styles.label}>Weight (kg)</Text>
                  </View>
                  <View style={styles.inputWithSuffix}>
                    <TextInput
                      style={[styles.input, styles.suffixInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder="0.000"
                      placeholderTextColor="#b0b0b0"
                      value={weightKg}
                      onChangeText={setWeightKg}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.suffixText}>kg</Text>
                  </View>
                  <Text style={styles.helperText}>Weight per unit (optional)</Text>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <Layers size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Category</Text>
                </View>

                <View style={styles.categoryGrid}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        categoryId === category.id && styles.categoryChipActive,
                      ]}
                      onPress={() => setCategoryId(category.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          categoryId === category.id && styles.categoryTextActive,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <LinkIcon size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Image & Availability</Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <LinkIcon size={14} color="#888" />
                    <Text style={styles.label}>Image URL</Text>
                  </View>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="https://example.com/image.jpg"
                    placeholderTextColor="#b0b0b0"
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    autoCapitalize="none"
                  />
                  <Text style={styles.helperText}>Direct link to product image (.jpg, .png, etc.)</Text>
                </View>

                <View style={styles.switchContainer}>
                  <View style={styles.switchContent}>
                    <View style={styles.labelRow}>
                      <ToggleRight size={14} color="#888" />
                      <Text style={styles.label}>Product Available</Text>
                    </View>
                    <Text style={styles.switchDescription}>
                      {isAvailable ? 'Product is visible and can be purchased' : 'Product is hidden from customers'}
                    </Text>
                  </View>
                  <Switch
                    value={isAvailable}
                    onValueChange={setIsAvailable}
                    trackColor={{ false: '#e5e7eb', true: '#fed7aa' }}
                    thumbColor={isAvailable ? '#ff8c00' : '#cbd5e1'}
                    ios_backgroundColor="#e5e7eb"
                  />
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <Ruler size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Sizes & Colors</Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Ruler size={14} color="#888" />
                    <Text style={styles.label}>Sizes</Text>
                    <Text style={styles.optionalTag}>optional</Text>
                  </View>
                  <View style={styles.tagInputRow}>
                    <TextInput
                      style={[styles.input, styles.tagInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder="e.g. S, M, L, XL"
                      placeholderTextColor="#b0b0b0"
                      value={sizeInput}
                      onChangeText={setSizeInput}
                      onSubmitEditing={addSize}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.tagAddBtn} onPress={addSize} activeOpacity={0.8}>
                      <Plus size={18} color="#ffffff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                  {sizes.length > 0 && (
                    <View style={styles.tagsWrap}>
                      {sizes.map((s) => (
                        <View key={s} style={styles.tag}>
                          <Text style={styles.tagText}>{s}</Text>
                          <TouchableOpacity onPress={() => removeSize(s)} activeOpacity={0.7}>
                            <X size={12} color="#ff8c00" strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.helperText}>Add size options customers can choose from</Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Palette size={14} color="#888" />
                    <Text style={styles.label}>Colors</Text>
                    <Text style={styles.optionalTag}>optional</Text>
                  </View>
                  <View style={styles.tagInputRow}>
                    <TextInput
                      style={[styles.input, styles.tagInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder="e.g. Red, Blue, Black"
                      placeholderTextColor="#b0b0b0"
                      value={colorInput}
                      onChangeText={setColorInput}
                      onSubmitEditing={addColor}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.tagAddBtn} onPress={addColor} activeOpacity={0.8}>
                      <Plus size={18} color="#ffffff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                  {colors.length > 0 && (
                    <View style={styles.tagsWrap}>
                      {colors.map((c) => (
                        <View key={c} style={styles.tag}>
                          <View style={[styles.colorDot, { backgroundColor: c.toLowerCase() }]} />
                          <Text style={styles.tagText}>{c}</Text>
                          <TouchableOpacity onPress={() => removeColor(c)} activeOpacity={0.7}>
                            <X size={12} color="#ff8c00" strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.helperText}>Add color options customers can choose from</Text>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <RotateCcw size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Return Policy</Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <RotateCcw size={14} color="#888" />
                    <Text style={styles.label}>Return Policy</Text>
                    <Text style={styles.optionalTag}>optional</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="e.g. Returns accepted within 7 days of delivery..."
                    placeholderTextColor="#b0b0b0"
                    value={returnPolicy}
                    onChangeText={setReturnPolicy}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <Truck size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Expected Delivery</Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Truck size={14} color="#888" />
                    <Text style={styles.label}>Delivery Time</Text>
                    <Text style={styles.optionalTag}>optional</Text>
                  </View>
                  <View style={styles.inputWithSuffix}>
                    <TextInput
                      style={[styles.input, styles.suffixInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder="e.g. 3"
                      placeholderTextColor="#b0b0b0"
                      value={expectedDeliveryDays}
                      onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, '');
                        setExpectedDeliveryDays(num);
                      }}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.suffixText}>days</Text>
                  </View>
                  <Text style={styles.helperText}>Estimated number of days for delivery after order placement</Text>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconWrap}>
                    <Percent size={18} color="#ff8c00" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Discount</Text>
                </View>

                <View style={styles.discountToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.discountToggleLabel}>Enable Discount</Text>
                    <Text style={styles.discountToggleSub}>
                      {discountActive ? 'Customers will see a discount badge' : 'No discount applied'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDiscountActive(!discountActive)} activeOpacity={0.7}>
                    {discountActive ? (
                      <ToggleRight size={32} color="#ff8c00" />
                    ) : (
                      <ToggleLeft size={32} color="#ccc" />
                    )}
                  </TouchableOpacity>
                </View>

                {discountActive && (
                  <View style={styles.discountInputRow}>
                    <TextInput
                      style={[styles.discountInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                      placeholder="0"
                      placeholderTextColor="#b0b0b0"
                      value={discountPercentage}
                      onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, '');
                        const clamped = Math.min(parseInt(num) || 0, 100);
                        setDiscountPercentage(num ? String(clamped) : '');
                      }}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.discountPercent}>%</Text>
                    {discountPercentage && parseFloat(price) > 0 && (
                      <View style={styles.discountPreview}>
                        <Text style={styles.discountPreviewLabel}>Sale price</Text>
                        <Text style={styles.discountPreviewPrice}>
                          {'\u20A6'}{(parseFloat(price) * (1 - (parseInt(discountPercentage) || 0) / 100)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 10 }} />
                    <Text style={styles.submitButtonText}>Updating...</Text>
                  </>
                ) : (
                  <>
                    <Save size={20} color="#ffffff" strokeWidth={2.5} />
                    <Text style={styles.submitButtonText}>Update Product</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.reviewsContainer}>
              <ProductReviews
                productId={product.id}
                vendorId={profile?.id || ''}
                averageRating={product.average_rating || 0}
                totalReviews={product.review_count || 0}
              />
            </View>
          )}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.display,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 5,
    gap: 4,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#fff7ed',
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#888',
  },
  tabTextActive: {
    color: '#ff8c00',
    fontFamily: Fonts.bold,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  sectionCardTitle: {
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  inputGroup: {
    marginBottom: 22,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#444',
    letterSpacing: -0.1,
  },
  required: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#ff8c00',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1.5,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  prefixText: {
    position: 'absolute',
    left: 16,
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#888',
    zIndex: 1,
  },
  prefixInput: {
    flex: 1,
    paddingLeft: 34,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  suffixInput: {
    flex: 1,
    paddingRight: 42,
  },
  suffixText: {
    position: 'absolute',
    right: 16,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#888',
    zIndex: 1,
  },
  helperText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#aaa',
    marginTop: 8,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  halfWidth: {
    flex: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#f8f8f8',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  categoryChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ff8c00',
  },
  categoryText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#888',
  },
  categoryTextActive: {
    color: '#ff8c00',
    fontFamily: Fonts.semiBold,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#888',
    lineHeight: 18,
    marginTop: 2,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.3,
  },
  reviewsContainer: {
    marginTop: 4,
  },
  discountToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  discountToggleLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#444',
  },
  discountToggleSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#888',
    marginTop: 2,
  },
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discountInput: {
    width: 80,
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 14,
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#1a1a1a',
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#ffedd5',
  },
  discountPercent: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#888',
  },
  discountPreview: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  discountPreviewLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discountPreviewPrice: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#059669',
  },
  optionalTag: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#aaa',
    marginLeft: 2,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    marginBottom: 0,
  },
  tagAddBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#ffedd5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  tagText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#c2410c',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
