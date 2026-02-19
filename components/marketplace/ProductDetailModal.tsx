import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { X, Star, ShoppingCart, Plus, Minus, MapPin, ZoomIn, ChevronLeft, ChevronRight, Percent, Ruler, Palette, RotateCcw } from 'lucide-react-native';
import { Product, Review } from '@/types/database';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cartEvents } from '@/lib/marketplace/cartEvents';
import ProductReviews from './ProductReviews';
import ReviewForm from './ReviewForm';
import ZoomableImage from './ZoomableImage';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

interface VendorInfo {
  business_name: string;
  city: string;
  state: string;
  rating: number;
}

interface ProductImage {
  id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
}

export default function ProductDetailModal({
  visible,
  product,
  onClose,
}: ProductDetailModalProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(product);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(0);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const fullScreenFlatListRef = useRef<FlatList>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVendorInfo = async () => {
    if (!product) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('business_name, city, state, rating')
        .eq('user_id', product.vendor_id)
        .maybeSingle();

      if (error) throw error;
      setVendorInfo(data);
    } catch (error) {
      console.error('Error fetching vendor:', error);
    }
  };

  const fetchProductImages = async () => {
    if (!product) return;

    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');

      if (error) throw error;
      if (data && data.length > 0) {
        setImages(data);
      } else {
        setImages([{
          id: 'default',
          image_url: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
          display_order: 0,
          is_primary: true,
        }]);
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
      setImages([{
        id: 'default',
        image_url: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
        display_order: 0,
        is_primary: true,
      }]);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setCurrentImageIndex(index);

    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }

    if (images.length > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentImageIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % images.length;
          flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
          return nextIndex;
        });
      }, 3000);
    }
  };

  const handleFullScreenScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    if (index !== fullScreenImageIndex) {
      setFullScreenImageIndex(index);
      setIsImageZoomed(false);
    }
  };

  const openFullScreenImage = (index: number) => {
    setFullScreenImageIndex(index);
    setShowFullScreenImage(true);
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  };

  const closeFullScreenImage = () => {
    setShowFullScreenImage(false);
    setIsImageZoomed(false);
  };

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setShowReviewForm(true);
  };

  const handleReviewSuccess = () => {
    setShowReviewForm(false);
    setEditingReview(null);
  };

  const navigateFullScreenImage = (direction: 'prev' | 'next') => {
    setIsImageZoomed(false);
    if (direction === 'prev') {
      setFullScreenImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    } else {
      setFullScreenImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    }
  };

  const addToCart = async () => {
    if (!profile || !product) return;

    try {
      setLoading(true);

      // Check if item already exists in cart
      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', profile.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingItem) {
        // Update existing item by adding to the quantity
        const { error } = await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Insert new item
        const { error } = await supabase
          .from('carts')
          .insert({
            user_id: profile.id,
            product_id: product.id,
            quantity: quantity,
          });

        if (error) throw error;
      }

      // Emit cart event to update badge
      cartEvents.emit();
      onClose();
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && product) {
      setCurrentProduct(product);
      setCurrentImageIndex(0);
      fetchVendorInfo();
      fetchProductImages();

      // Subscribe to real-time product updates for rating changes
      const subscription = supabase
        .channel(`product_${product.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'products',
            filter: `id=eq.${product.id}`,
          },
          (payload) => {
            setCurrentProduct(payload.new as Product);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } else if (!visible) {
      setVendorInfo(null);
      setImages([]);
      setQuantity(1);
      setCurrentProduct(null);
      setSelectedSize(null);
      setSelectedColor(null);
    }
  }, [visible, product]);

  useEffect(() => {
    if (!visible || images.length <= 1) return;

    const startAutoPlay = () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentImageIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % images.length;
          flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
          return nextIndex;
        });
      }, 3000);
    };

    startAutoPlay();

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [visible, images.length]);

  if (!currentProduct) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.imageContainer}>
              <FlatList
                ref={flatListRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => openFullScreenImage(index)}
                  >
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.productImage}
                      resizeMode="cover"
                      defaultSource={{ uri: currentProduct?.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg' }}
                    />
                    <View style={styles.zoomIndicator}>
                      <ZoomIn size={20} color="#ffffff" />
                    </View>
                  </TouchableOpacity>
                )}
              />
              {images.length > 1 && (
                <View style={styles.pagination}>
                  {images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentImageIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.imageOverlay}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <X size={20} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
              {currentProduct.discount_active && currentProduct.discount_percentage > 0 && (
                <View style={styles.imageDiscountBadge}>
                  <Text style={styles.imageDiscountBadgeText}>-{currentProduct.discount_percentage}%</Text>
                </View>
              )}
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.productHeader}>
                <View style={styles.productTitleRow}>
                  <Text style={styles.productName}>{currentProduct.name}</Text>
                  <View style={styles.stockBadge}>
                    <View style={styles.stockDot} />
                    <Text style={styles.stockText}>{currentProduct.stock_quantity} left</Text>
                  </View>
                </View>

                <View style={styles.ratingRow}>
                  <View style={styles.ratingContainer}>
                    <Star size={16} color="#fbbf24" fill="#fbbf24" />
                    <Text style={styles.rating}>{currentProduct.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.reviewCount}>{currentProduct.total_reviews} reviews</Text>
                </View>
              </View>

              <View style={styles.priceSection}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>
                    {currentProduct.discount_active && currentProduct.discount_percentage > 0 ? 'Sale Price' : 'Price'}
                  </Text>
                  <View style={styles.priceRow}>
                    {currentProduct.discount_active && currentProduct.discount_percentage > 0 ? (
                      <>
                        <Text style={styles.price}>
                          ₦{(currentProduct.price * (1 - currentProduct.discount_percentage / 100)).toFixed(2)}
                        </Text>
                        <Text style={styles.unit}>/ {currentProduct.unit}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.price}>₦{currentProduct.price.toFixed(2)}</Text>
                        <Text style={styles.unit}>/ {currentProduct.unit}</Text>
                      </>
                    )}
                  </View>
                  {currentProduct.discount_active && currentProduct.discount_percentage > 0 && (
                    <View style={styles.discountRow}>
                      <View style={styles.discountBadgeInline}>
                        <Percent size={12} color="#ffffff" />
                        <Text style={styles.discountBadgeInlineText}>-{currentProduct.discount_percentage}% OFF</Text>
                      </View>
                      <Text style={styles.originalPriceText}>₦{currentProduct.price.toFixed(2)}</Text>
                    </View>
                  )}
                </View>
              </View>

              {currentProduct.description && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About this product</Text>
                  <Text style={styles.description}>{currentProduct.description}</Text>
                </View>
              )}

              {currentProduct.sizes && currentProduct.sizes.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.optionHeader}>
                    <Ruler size={16} color="#ff8c00" strokeWidth={2.2} />
                    <Text style={styles.sectionTitle}>Size</Text>
                    {selectedSize && <Text style={styles.selectedLabel}>{selectedSize}</Text>}
                  </View>
                  <View style={styles.optionGrid}>
                    {currentProduct.sizes.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.optionChip, selectedSize === s && styles.optionChipActive]}
                        onPress={() => setSelectedSize(selectedSize === s ? null : s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionChipText, selectedSize === s && styles.optionChipTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {currentProduct.colors && currentProduct.colors.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.optionHeader}>
                    <Palette size={16} color="#ff8c00" strokeWidth={2.2} />
                    <Text style={styles.sectionTitle}>Color</Text>
                    {selectedColor && <Text style={styles.selectedLabel}>{selectedColor}</Text>}
                  </View>
                  <View style={styles.optionGrid}>
                    {currentProduct.colors.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.optionChip, selectedColor === c && styles.optionChipActive]}
                        onPress={() => setSelectedColor(selectedColor === c ? null : c)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.colorDot, { backgroundColor: c.toLowerCase() }]} />
                        <Text style={[styles.optionChipText, selectedColor === c && styles.optionChipTextActive]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {currentProduct.return_policy && (
                <View style={styles.section}>
                  <View style={styles.optionHeader}>
                    <RotateCcw size={16} color="#ff8c00" strokeWidth={2.2} />
                    <Text style={styles.sectionTitle}>Return Policy</Text>
                  </View>
                  <View style={styles.returnPolicyCard}>
                    <Text style={styles.returnPolicyText}>{currentProduct.return_policy}</Text>
                  </View>
                </View>
              )}

              {vendorInfo && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sold by</Text>
                  <View style={styles.vendorCard}>
                    <View style={styles.vendorHeader}>
                      <View style={styles.vendorAvatar}>
                        <Text style={styles.vendorAvatarText}>
                          {vendorInfo.business_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.vendorDetails}>
                        <Text style={styles.vendorName}>{vendorInfo.business_name}</Text>
                        <View style={styles.locationRow}>
                          <MapPin size={12} color="#6b7280" />
                          <Text style={styles.location}>
                            {vendorInfo.city}, {vendorInfo.state}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.vendorRatingBadge}>
                        <Star size={12} color="#fbbf24" fill="#fbbf24" />
                        <Text style={styles.vendorRatingText}>
                          {vendorInfo.rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Reviews</Text>
                <ProductReviews
                  productId={currentProduct.id}
                  vendorId={currentProduct.vendor_id}
                  averageRating={currentProduct.rating}
                  totalReviews={currentProduct.total_reviews}
                  onEditReview={handleEditReview}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity === 1 && styles.quantityButtonDisabled]}
                      onPress={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity === 1}
                    >
                      <Minus size={18} color={quantity === 1 ? '#d1d5db' : '#6b7280'} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <View style={styles.quantityDisplay}>
                      <Text style={styles.quantity}>{quantity}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity >= currentProduct.stock_quantity && styles.quantityButtonDisabled]}
                      onPress={() => setQuantity(Math.min(currentProduct.stock_quantity, quantity + 1))}
                      disabled={quantity >= currentProduct.stock_quantity}
                    >
                      <Plus size={18} color={quantity >= currentProduct.stock_quantity ? '#d1d5db' : '#6b7280'} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.subtotalContainer}>
                    <Text style={styles.subtotalLabel}>Subtotal</Text>
                    <Text style={styles.subtotalAmount}>
                      ₦{((currentProduct.discount_active && currentProduct.discount_percentage > 0
                        ? currentProduct.price * (1 - currentProduct.discount_percentage / 100)
                        : currentProduct.price) * quantity).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.bottomSpacing} />
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={[styles.addButton, loading && styles.addButtonDisabled]}
              onPress={addToCart}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <ShoppingCart size={20} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.addButtonText}>Add to Cart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

      <Modal
        visible={showFullScreenImage}
        animationType="fade"
        transparent={true}
        onRequestClose={closeFullScreenImage}
      >
        <View style={styles.fullScreenOverlay}>
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity
              style={[styles.fullScreenCloseButton, { top: insets.top + 16 }]}
              onPress={closeFullScreenImage}
              activeOpacity={0.8}
            >
              <View style={styles.closeButtonCircle}>
                <X size={24} color="#ffffff" strokeWidth={3} />
              </View>
            </TouchableOpacity>

            {Platform.OS === 'web' ? (
              <View style={styles.webImageContainer}>
                {images.length > 1 && (
                  <TouchableOpacity
                    style={styles.navButtonLeft}
                    onPress={() => navigateFullScreenImage('prev')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.navButtonCircle}>
                      <ChevronLeft size={32} color="#ffffff" strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>
                )}
                <View style={styles.webImageWrapper}>
                  <ZoomableImage
                    uri={images[fullScreenImageIndex]?.image_url}
                    defaultUri={currentProduct?.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                    onZoomChange={setIsImageZoomed}
                  />
                </View>
                {images.length > 1 && (
                  <TouchableOpacity
                    style={styles.navButtonRight}
                    onPress={() => navigateFullScreenImage('next')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.navButtonCircle}>
                      <ChevronRight size={32} color="#ffffff" strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                ref={fullScreenFlatListRef}
                data={images}
                horizontal
                pagingEnabled
                scrollEnabled={!isImageZoomed}
                showsHorizontalScrollIndicator={false}
                onScroll={handleFullScreenScroll}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                initialScrollIndex={fullScreenImageIndex > 0 ? fullScreenImageIndex : undefined}
                getItemLayout={(data, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    fullScreenFlatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: false,
                    });
                  }, 100);
                }}
                renderItem={({ item }) => (
                  <View style={styles.fullScreenImageContainer}>
                    <ZoomableImage
                      uri={item.image_url}
                      defaultUri={currentProduct?.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                      onZoomChange={setIsImageZoomed}
                    />
                  </View>
                )}
              />
            )}

            <View style={styles.fullScreenPagination}>
              {images.length > 1 ? (
                <Text style={styles.fullScreenPaginationText}>
                  {fullScreenImageIndex + 1} / {images.length}
                </Text>
              ) : (
                <Text style={styles.fullScreenPaginationText}>1 / 1</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReviewForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewForm(false)}
      >
        <View style={styles.reviewFormOverlay}>
          <View style={styles.reviewFormContent}>
            <ReviewForm
              productId={currentProduct?.id || ''}
              existingReview={editingReview || undefined}
              onSuccess={handleReviewSuccess}
              onCancel={() => {
                setShowReviewForm(false);
                setEditingReview(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 380,
    backgroundColor: '#f3f4f6',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: 380,
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#ffffff',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
    padding: 10,
  },
  contentContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  productHeader: {
    marginBottom: 20,
  },
  productTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  productName: {
    flex: 1,
    fontSize: 26,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  stockText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#16a34a',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef9f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  rating: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#92400e',
  },
  reviewCount: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  priceSection: {
    backgroundColor: '#fff7ed',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  priceContainer: {
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 34,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#92400e',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#555',
    lineHeight: 24,
  },
  vendorCard: {
    backgroundColor: '#fafaf8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorAvatarText: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  vendorDetails: {
    flex: 1,
    gap: 4,
  },
  vendorName: {
    fontSize: 16,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  vendorRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef9f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  vendorRatingText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#92400e',
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
    borderRadius: 16,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityDisplay: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quantity: {
    fontSize: 20,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
  },
  subtotalContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  subtotalLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtotalAmount: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    letterSpacing: -0.5,
  },
  bottomSpacing: {
    height: 24,
  },
  footer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
  },
  addButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 24,
    padding: 10,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  fullScreenContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
  },
  closeButtonCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 28,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  webImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webImageWrapper: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonLeft: {
    position: 'absolute',
    left: 30,
    top: '50%',
    transform: [{ translateY: -30 }],
    zIndex: 1000,
  },
  navButtonRight: {
    position: 'absolute',
    right: 30,
    top: '50%',
    transform: [{ translateY: -30 }],
    zIndex: 1000,
  },
  navButtonCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 40,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  zoomableContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    maxWidth: SCREEN_WIDTH,
    backgroundColor: '#000000',
  },
  fullScreenPagination: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 998,
  },
  fullScreenPaginationText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.bold,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  reviewFormOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewFormContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageDiscountBadge: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  imageDiscountBadgeText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  discountBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  discountBadgeInlineText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  originalPriceText: {
    fontSize: 18,
    fontFamily: Fonts.medium,
    color: '#92400e',
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectedLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
    marginLeft: 4,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#f8f8f8',
    borderWidth: 1.5,
    borderColor: '#eee',
    gap: 6,
  },
  optionChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ff8c00',
  },
  optionChipText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#555',
  },
  optionChipTextActive: {
    color: '#c2410c',
    fontFamily: Fonts.semiBold,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  returnPolicyCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  returnPolicyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#166534',
    lineHeight: 22,
  },
});
