import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
  Package,
  Tag,
  DollarSign,
  Layers,
  FileText,
  Info,
  Percent,
  ToggleLeft,
  ToggleRight,
  Scale,
  Ruler,
  Palette,
  RotateCcw,
  Truck,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/marketplace/supabase';
import { Category } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Fonts } from '@/constants/fonts';

interface ImageItem {
  id: string;
  uri: string;
  isUrl: boolean;
  isPrimary: boolean;
}

interface AddProductProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AddProduct({ onBack, onSuccess }: AddProductProps) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    price: '',
    unit: 'lb',
    stock_quantity: '',
    weight_kg: '',
    discount_percentage: '',
    discount_active: false,
    return_policy: '',
    expected_delivery_days: '',
  });

  const [sizeInput, setSizeInput] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    fetchCategories();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll permissions are required to upload images.');
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, category_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        const newImages: ImageItem[] = result.assets.map((asset) => ({
          id: Math.random().toString(36).substr(2, 9),
          uri: asset.uri,
          isUrl: false,
          isPrimary: images.length === 0,
        }));
        setImages([...images, ...newImages]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const addImageFromUrl = () => {
    const url = imageUrl.trim();

    if (!url) {
      Alert.alert('Error', 'Please enter a valid image URL');
      return;
    }

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const hasValidExtension = validExtensions.some(ext =>
      url.toLowerCase().includes(ext)
    );

    if (!hasValidExtension) {
      Alert.alert(
        'Invalid Image URL',
        'Please use a direct image URL ending with .jpg, .png, .jpeg, etc.\n\nExample from Pexels:\nhttps://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg\n\nNote: Do not use webpage URLs from Pixabay, Google Photos, or image hosting pages.'
      );
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Error', 'Image URL must start with http:// or https://');
      return;
    }

    const newImage: ImageItem = {
      id: Math.random().toString(36).substr(2, 9),
      uri: url,
      isUrl: true,
      isPrimary: images.length === 0,
    };

    setImages([...images, newImage]);
    setImageUrl('');
    setShowUrlInput(false);
  };

  const removeImage = (id: string) => {
    const filteredImages = images.filter((img) => img.id !== id);
    if (filteredImages.length > 0 && images.find((img) => img.id === id)?.isPrimary) {
      filteredImages[0].isPrimary = true;
    }
    setImages(filteredImages);
  };

  const setPrimaryImage = (id: string) => {
    setImages(
      images.map((img) => ({
        ...img,
        isPrimary: img.id === id,
      }))
    );
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

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return false;
    }
    if (!formData.category_id) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0) {
      Alert.alert('Error', 'Please enter a valid stock quantity');
      return false;
    }
    return true;
  };

  const uploadImageToStorage = async (uri: string, productId: string, index: number): Promise<string | null> => {
    try {
      let fileData: Blob | ArrayBuffer;
      let contentType = 'image/jpeg';
      let fileExt = 'jpg';

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileData = blob;
        contentType = blob.type || 'image/jpeg';

        if (blob.type) {
          const mimeToExt: { [key: string]: string } = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
          };
          fileExt = mimeToExt[blob.type] || 'jpg';
        }
      } else {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = arrayBuffer;

        if (uri.toLowerCase().includes('.png')) {
          contentType = 'image/png';
          fileExt = 'png';
        } else if (uri.toLowerCase().includes('.gif')) {
          contentType = 'image/gif';
          fileExt = 'gif';
        } else if (uri.toLowerCase().includes('.webp')) {
          contentType = 'image/webp';
          fileExt = 'webp';
        }
      }

      const fileName = `${productId}_${index}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, fileData, {
          contentType: contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (uploadError.message.includes('Bucket not found')) {
          Alert.alert(
            'Storage Setup Required',
            'Please create a storage bucket named "product-images" in your Supabase dashboard first. For now, use "Add image URL" button with web image URLs like those from Pexels.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Upload Error', uploadError.message);
        }
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      console.log('Uploaded image URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!profile) return;

    try {
      setLoading(true);

      const { data: vendorRecord, error: vendorLookupError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (vendorLookupError) throw vendorLookupError;
      if (!vendorRecord) throw new Error('Vendor profile not found. Please complete your store setup first.');

      const discountPct = parseInt(formData.discount_percentage) || 0;
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          vendor_id: profile.id,
          category_id: formData.category_id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          image_url: null,
          price: parseFloat(formData.price),
          unit: formData.unit,
          stock_quantity: parseInt(formData.stock_quantity),
          weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
          is_available: true,
          is_featured: false,
          discount_percentage: Math.min(Math.max(discountPct, 0), 100),
          discount_active: formData.discount_active && discountPct > 0,
          sizes: sizes.length > 0 ? sizes : null,
          colors: colors.length > 0 ? colors : null,
          return_policy: formData.return_policy.trim() || null,
          expected_delivery_days: formData.expected_delivery_days ? parseInt(formData.expected_delivery_days) : null,
        })
        .select()
        .single();

      if (productError) throw productError;

      if (images.length > 0) {
        const uploadedImages = await Promise.all(
          images.map(async (img, index) => {
            let finalUrl: string | null = null;

            if (img.isUrl) {
              finalUrl = img.uri;
            } else {
              finalUrl = await uploadImageToStorage(img.uri, product.id, index);
            }

            return finalUrl ? {
              product_id: product.id,
              image_url: finalUrl,
              display_order: index,
              is_primary: img.isPrimary,
            } : null;
          })
        );

        const validImages = uploadedImages.filter((img): img is NonNullable<typeof img> => img !== null);

        if (validImages.length === 0) {
          await supabase.from('products').delete().eq('id', product.id);
          Alert.alert(
            'Upload Failed',
            'Failed to upload images. Please use "Add image URL" with web image URLs instead.'
          );
          return;
        }

        const { error: imagesError } = await supabase
          .from('product_images')
          .insert(validImages);

        if (imagesError) throw imagesError;

        const primaryImage = validImages.find((img) => img.is_primary);
        if (primaryImage) {
          await supabase
            .from('products')
            .update({ image_url: primaryImage.image_url })
            .eq('id', product.id);
        }
      }

      Alert.alert('Success', 'Product added successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#1a1a1a" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Add New Product</Text>
          <Text style={styles.headerSubtitle}>Create a new listing for your store</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <ImageIcon size={18} color="#ff8c00" strokeWidth={2.2} />
            </View>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Product Images</Text>
              <Text style={styles.sectionSubtitle}>
                First image will be the primary image shown in listings
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.infoBox}>
              <Info size={14} color="#92400e" strokeWidth={2.2} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  Use direct image URLs from Pexels or other sources ending with .jpg, .png, etc.
                </Text>
              </View>
            </View>

            <View style={styles.imagesGrid}>
              {images.map((image) => (
                <View key={image.id} style={styles.imageCard}>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  {image.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(image.id)}
                  >
                    <X size={14} color="#ffffff" strokeWidth={2.5} />
                  </TouchableOpacity>
                  {!image.isPrimary && (
                    <TouchableOpacity
                      style={styles.setPrimaryButton}
                      onPress={() => setPrimaryImage(image.id)}
                    >
                      <Text style={styles.setPrimaryText}>Set as primary</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addImageButton} onPress={pickImages} activeOpacity={0.7}>
                <View style={styles.addImageIconWrap}>
                  <Upload size={22} color="#ff8c00" strokeWidth={2} />
                </View>
                <Text style={styles.addImageText}>Upload</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addImageButton}
                onPress={() => setShowUrlInput(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addImageIconWrap}>
                  <LinkIcon size={22} color="#ff8c00" strokeWidth={2} />
                </View>
                <Text style={styles.addImageText}>Add URL</Text>
              </TouchableOpacity>
            </View>

            {showUrlInput && (
              <View style={styles.urlInputContainer}>
                <TextInput
                  style={[styles.urlInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor="#b0b0b0"
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.addUrlButton} onPress={addImageFromUrl} activeOpacity={0.8}>
                  <Plus size={20} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelUrlButton}
                  onPress={() => {
                    setShowUrlInput(false);
                    setImageUrl('');
                  }}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#6b7280" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Package size={18} color="#ff8c00" strokeWidth={2.2} />
            </View>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Product Information</Text>
              <Text style={styles.sectionSubtitle}>Basic details about your product</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Tag size={14} color="#888" />
                <Text style={styles.label}>Product Name</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <TextInput
                style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="e.g., Organic Tomatoes"
                placeholderTextColor="#b0b0b0"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <FileText size={14} color="#888" />
                <Text style={styles.label}>Description</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Describe your product in detail..."
                placeholderTextColor="#b0b0b0"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Layers size={14} color="#888" />
                <Text style={styles.label}>Category</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <View style={styles.categoryGrid}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      formData.category_id === category.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setFormData({ ...formData, category_id: category.id })}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        formData.category_id === category.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
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
                    value={formData.price}
                    onChangeText={(text) => setFormData({ ...formData, price: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <View style={styles.labelRow}>
                  <Package size={14} color="#888" />
                  <Text style={styles.label}>Unit</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  placeholder="lb, kg, piece"
                  placeholderTextColor="#b0b0b0"
                  value={formData.unit}
                  onChangeText={(text) => setFormData({ ...formData, unit: text })}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <View style={styles.labelRow}>
                  <Layers size={14} color="#888" />
                  <Text style={styles.label}>Stock Quantity</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  placeholder="0"
                  placeholderTextColor="#b0b0b0"
                  value={formData.stock_quantity}
                  onChangeText={(text) => setFormData({ ...formData, stock_quantity: text })}
                  keyboardType="number-pad"
                />
                <Text style={styles.helperText}>Items available for sale</Text>
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <View style={styles.labelRow}>
                  <Scale size={14} color="#888" />
                  <Text style={styles.label}>Weight (kg)</Text>
                </View>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.input, styles.suffixInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="0.000"
                    placeholderTextColor="#b0b0b0"
                    value={formData.weight_kg}
                    onChangeText={(text) => setFormData({ ...formData, weight_kg: text })}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.suffixText}>kg</Text>
                </View>
                <Text style={styles.helperText}>Weight per unit</Text>
              </View>
            </View>

            <View style={styles.discountDivider} />

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ruler size={14} color="#888" />
                <Text style={styles.label}>Sizes</Text>
                <Text style={styles.optionalTag}>optional</Text>
              </View>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.tagInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
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
                  style={[styles.tagInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
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
                value={formData.return_policy}
                onChangeText={(text) => setFormData({ ...formData, return_policy: text })}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Truck size={14} color="#888" />
                <Text style={styles.label}>Expected Delivery</Text>
                <Text style={styles.optionalTag}>optional</Text>
              </View>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.input, styles.suffixInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  placeholder="e.g. 3"
                  placeholderTextColor="#b0b0b0"
                  value={formData.expected_delivery_days}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, expected_delivery_days: num });
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.suffixText}>days</Text>
              </View>
              <Text style={styles.helperText}>Estimated number of days for delivery after order placement</Text>
            </View>

            <View style={styles.discountDivider} />

            <View style={styles.discountSection}>
              <View style={styles.discountHeaderRow}>
                <View style={styles.discountIconWrap}>
                  <Percent size={16} color="#ff8c00" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.discountHeaderTitle}>Discount</Text>
                  <Text style={styles.discountHeaderSub}>Set a percentage off for customers</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, discount_active: !formData.discount_active })}
                  activeOpacity={0.7}
                >
                  {formData.discount_active ? (
                    <ToggleRight size={32} color="#ff8c00" />
                  ) : (
                    <ToggleLeft size={32} color="#ccc" />
                  )}
                </TouchableOpacity>
              </View>

              {formData.discount_active && (
                <View style={styles.discountInputRow}>
                  <TextInput
                    style={[styles.discountInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="0"
                    placeholderTextColor="#b0b0b0"
                    value={formData.discount_percentage}
                    onChangeText={(text) => {
                      const num = text.replace(/[^0-9]/g, '');
                      const clamped = Math.min(parseInt(num) || 0, 100);
                      setFormData({ ...formData, discount_percentage: num ? String(clamped) : '' });
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.discountPercent}>%</Text>
                  {formData.discount_percentage && parseFloat(formData.price) > 0 && (
                    <View style={styles.discountPreview}>
                      <Text style={styles.discountPreviewLabel}>Sale price</Text>
                      <Text style={styles.discountPreviewPrice}>
                        {'\u20A6'}{(parseFloat(formData.price) * (1 - (parseInt(formData.discount_percentage) || 0) / 100)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#ffffff" style={{ marginRight: 10 }} />
              <Text style={styles.submitButtonText}>Creating Product...</Text>
            </>
          ) : (
            <>
              <Plus size={22} color="#ffffff" strokeWidth={2.5} />
              <Text style={styles.submitButtonText}>Add Product</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f8f5f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#888',
    marginTop: 2,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
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
  sectionTitleContainer: {
    flex: 1,
    paddingTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#888',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fef3c7',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#92400e',
    lineHeight: 18,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageCard: {
    width: 110,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#eee',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#ff8c00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setPrimaryButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
  },
  setPrimaryText: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  addImageButton: {
    width: 110,
    height: 110,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffedd5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbf5',
  },
  addImageIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
    textAlign: 'center',
  },
  urlInputContainer: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  addUrlButton: {
    width: 48,
    height: 48,
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelUrlButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
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
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
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
  categoryChipText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#888',
  },
  categoryChipTextActive: {
    color: '#ff8c00',
    fontFamily: Fonts.semiBold,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  flex1: {
    flex: 1,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  discountDivider: {
    height: 1,
    backgroundColor: '#f0ebe4',
    marginVertical: 4,
    marginBottom: 18,
  },
  discountSection: {
    gap: 14,
  },
  discountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discountIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  discountHeaderTitle: {
    fontSize: 15,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
  },
  discountHeaderSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#888',
    marginTop: 1,
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
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#eee',
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
