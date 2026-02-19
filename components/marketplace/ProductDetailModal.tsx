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
import { X, Star, ShoppingCart, Plus, Minus, MapPin, ZoomIn, ChevronLeft, ChevronRight, Percent, Ruler, Palette, RotateCcw, Truck, Package, Award, ShieldCheck, AlertCircle, Clock } from 'lucide-react-native';
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
  const [showReturnPolicy, setShowReturnPolicy] = useState(false);
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

      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', profile.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carts')
          .insert({
            user_id: profile.id,
            product_id: product.id,
            quantity: quantity,
          });

        if (error) throw error;
      }

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

  const hasDiscount = currentProduct.discount_active && currentProduct.discount_percentage > 0;
  const salePrice = hasDiscount
    ? currentProduct.price * (1 - currentProduct.discount_percentage / 100)
    : currentProduct.price;
  const subtotal = salePrice * quantity;

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
              {/* Image Gallery */}
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
                    </TouchableOpacity>
                  )}
                />

                {/* Gradient overlay at bottom of image */}
                <View style={styles.imageGradient} />

                {/* Close button */}
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
                  <X size={18} color="#1a1a1a" strokeWidth={2.5} />
                </TouchableOpacity>

                {/* Zoom hint */}
                <View style={styles.zoomIndicator}>
                  <ZoomIn size={14} color="#fff" />
                  <Text style={styles.zoomText}>Tap to zoom</Text>
                </View>

                {/* Discount badge on image */}
                {hasDiscount && (
                  <View style={styles.imageDiscountBadge}>
                    <Text style={styles.imageDiscountBadgeText}>-{currentProduct.discount_percentage}%</Text>
                  </View>
                )}

                {/* Pagination dots */}
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
              </View>

              {/* Content panel — floats up over image */}
              <View style={styles.contentContainer}>
                {/* Handle bar */}
                <View style={styles.handleBar} />

                {/* Header: name + stock */}
                <View style={styles.productHeader}>
                  <View style={styles.categoryPill}>
                    <Package size={11} color="#ff8c00" strokeWidth={2.2} />
                    <Text style={styles.categoryPillText}>{currentProduct.unit} unit</Text>
                  </View>

                  <Text style={styles.productName}>{currentProduct.name}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.ratingPill}>
                      <Star size={13} color="#f59e0b" fill="#f59e0b" />
                      <Text style={styles.ratingValue}>{currentProduct.rating.toFixed(1)}</Text>
                      <Text style={styles.ratingDivider}>·</Text>
                      <Text style={styles.reviewCountText}>{currentProduct.total_reviews} reviews</Text>
                    </View>

                    <View style={styles.stockPill}>
                      <View style={styles.stockPulse} />
                      <Text style={styles.stockText}>{currentProduct.stock_quantity} in stock</Text>
                    </View>
                  </View>
                </View>

                {/* Price card */}
                <View style={styles.priceCard}>
                  <View style={styles.priceLeft}>
                    {hasDiscount ? (
                      <>
                        <View style={styles.saleLabelRow}>
                          <View style={styles.saveBadge}>
                            <Percent size={10} color="#fff" strokeWidth={2.5} />
                            <Text style={styles.saveBadgeText}>SAVE {currentProduct.discount_percentage}%</Text>
                          </View>
                        </View>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceMain}>₦{salePrice.toFixed(2)}</Text>
                          <Text style={styles.priceUnit}>/ {currentProduct.unit}</Text>
                        </View>
                        <Text style={styles.originalPrice}>was ₦{currentProduct.price.toFixed(2)}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.priceLabelText}>Price</Text>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceMain}>₦{currentProduct.price.toFixed(2)}</Text>
                          <Text style={styles.priceUnit}>/ {currentProduct.unit}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Quantity selector embedded in price card */}
                  <View style={styles.qtyBlock}>
                    <Text style={styles.qtyLabel}>Qty</Text>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, quantity === 1 && styles.qtyBtnDisabled]}
                        onPress={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity === 1}
                        activeOpacity={0.7}
                      >
                        <Minus size={14} color={quantity === 1 ? '#d1d5db' : '#1a1a1a'} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{quantity}</Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, quantity >= currentProduct.stock_quantity && styles.qtyBtnDisabled]}
                        onPress={() => setQuantity(Math.min(currentProduct.stock_quantity, quantity + 1))}
                        disabled={quantity >= currentProduct.stock_quantity}
                        activeOpacity={0.7}
                      >
                        <Plus size={14} color={quantity >= currentProduct.stock_quantity ? '#d1d5db' : '#1a1a1a'} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Subtotal strip */}
                <View style={styles.subtotalStrip}>
                  <Text style={styles.subtotalStripLabel}>Total</Text>
                  <Text style={styles.subtotalStripAmount}>₦{subtotal.toFixed(2)}</Text>
                </View>

                {/* Description */}
                {currentProduct.description && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About this product</Text>
                    <Text style={styles.description}>{currentProduct.description}</Text>
                  </View>
                )}

                {/* Sizes */}
                {currentProduct.sizes && currentProduct.sizes.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                      <Ruler size={15} color="#ff8c00" strokeWidth={2.2} />
                      <Text style={styles.sectionTitle}>Size</Text>
                      {selectedSize && <View style={styles.selectedPill}><Text style={styles.selectedPillText}>{selectedSize}</Text></View>}
                    </View>
                    <View style={styles.chipGrid}>
                      {currentProduct.sizes.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.chip, selectedSize === s && styles.chipActive]}
                          onPress={() => setSelectedSize(selectedSize === s ? null : s)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, selectedSize === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Colors */}
                {currentProduct.colors && currentProduct.colors.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                      <Palette size={15} color="#ff8c00" strokeWidth={2.2} />
                      <Text style={styles.sectionTitle}>Color</Text>
                      {selectedColor && <View style={styles.selectedPill}><Text style={styles.selectedPillText}>{selectedColor}</Text></View>}
                    </View>
                    <View style={styles.chipGrid}>
                      {currentProduct.colors.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.chip, selectedColor === c && styles.chipActive]}
                          onPress={() => setSelectedColor(selectedColor === c ? null : c)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.colorSwatch, { backgroundColor: c.toLowerCase() }]} />
                          <Text style={[styles.chipText, selectedColor === c && styles.chipTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Info cards row: delivery + return policy */}
                {(currentProduct.expected_delivery_days != null || currentProduct.return_policy) && (
                  <View style={styles.infoCardsRow}>
                    {currentProduct.expected_delivery_days != null && (
                      <View style={[styles.infoCard, styles.infoCardDelivery]}>
                        <View style={styles.infoCardIcon}>
                          <Truck size={18} color="#ff8c00" strokeWidth={2} />
                        </View>
                        <Text style={styles.infoCardValue}>
                          {currentProduct.expected_delivery_days} {currentProduct.expected_delivery_days === 1 ? 'day' : 'days'}
                        </Text>
                        <Text style={styles.infoCardLabel}>Delivery</Text>
                      </View>
                    )}
                    {currentProduct.return_policy && (
                      <TouchableOpacity
                        style={[styles.infoCard, styles.infoCardReturn]}
                        onPress={() => setShowReturnPolicy(true)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.infoCardIcon}>
                          <RotateCcw size={18} color="#16a34a" strokeWidth={2} />
                        </View>
                        <Text style={[styles.infoCardValue, { color: '#166534' }]}>Returns</Text>
                        <Text style={[styles.infoCardLabel, { color: '#166534' }]} numberOfLines={2}>{currentProduct.return_policy}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Vendor card */}
                {vendorInfo && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sold by</Text>
                    <View style={styles.vendorCard}>
                      <View style={styles.vendorAvatar}>
                        <Text style={styles.vendorAvatarText}>
                          {vendorInfo.business_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.vendorDetails}>
                        <Text style={styles.vendorName}>{vendorInfo.business_name}</Text>
                        <View style={styles.locationRow}>
                          <MapPin size={11} color="#9ca3af" />
                          <Text style={styles.locationText}>{vendorInfo.city}, {vendorInfo.state}</Text>
                        </View>
                      </View>
                      <View style={styles.vendorRatingPill}>
                        <Award size={11} color="#f59e0b" fill="#f59e0b" />
                        <Text style={styles.vendorRatingText}>{vendorInfo.rating.toFixed(1)}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Reviews */}
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

                <View style={styles.bottomSpacing} />
              </View>
            </ScrollView>

            {/* Footer CTA */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.footerInner}>
                <View style={styles.footerPriceBlock}>
                  <Text style={styles.footerPriceLabel}>Total</Text>
                  <Text style={styles.footerPrice}>₦{subtotal.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addButton, loading && styles.addButtonDisabled]}
                  onPress={addToCart}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <ShoppingCart size={19} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.addButtonText}>Add to Cart</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full screen image viewer */}
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

      {/* Review form */}
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

      {/* Return policy sheet */}
      <Modal
        visible={showReturnPolicy}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReturnPolicy(false)}
      >
        <View style={styles.rpOverlay}>
          <TouchableOpacity style={styles.rpBackdrop} onPress={() => setShowReturnPolicy(false)} />
          <View style={[styles.rpSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.rpHandle} />
            <View style={styles.rpHeader}>
              <View style={styles.rpHeaderLeft}>
                <View style={styles.rpIconWrap}>
                  <ShieldCheck size={22} color="#059669" strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.rpTitle}>Return Policy</Text>
                  <Text style={styles.rpProductName} numberOfLines={1}>{currentProduct?.name}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.rpCloseBtn} onPress={() => setShowReturnPolicy(false)}>
                <X size={18} color="#64748b" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.rpBody} showsVerticalScrollIndicator={false}>
              <View style={styles.rpNotice}>
                <AlertCircle size={14} color="#0369a1" strokeWidth={2} />
                <Text style={styles.rpNoticeText}>
                  Please read this policy carefully before making a purchase.
                </Text>
              </View>
              <Text style={styles.rpPolicyText}>{currentProduct?.return_policy}</Text>
              <View style={styles.rpFooterNote}>
                <Clock size={13} color="#94a3b8" strokeWidth={2} />
                <Text style={styles.rpFooterNoteText}>
                  Contact the vendor or support team to initiate a return.
                </Text>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.rpDoneBtn} onPress={() => setShowReturnPolicy(false)}>
              <Text style={styles.rpDoneBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f9f7f4',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* ── Image gallery ─────────────────────────────────────────────── */
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 360,
    backgroundColor: '#ede8e0',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: 360,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 56,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  zoomText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#fff',
  },
  imageDiscountBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  imageDiscountBadgeText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },
  pagination: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: '#ffffff',
    borderRadius: 3,
  },

  /* ── Content panel ────────────────────────────────────────────── */
  contentContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingTop: 16,
    paddingHorizontal: 22,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e0d8',
    alignSelf: 'center',
    marginBottom: 20,
  },

  /* ── Product header ───────────────────────────────────────────── */
  productHeader: {
    marginBottom: 20,
    gap: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  categoryPillText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#c2410c',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  productName: {
    fontSize: 28,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
    lineHeight: 36,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fefce8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  ratingValue: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#854d0e',
  },
  ratingDivider: {
    fontSize: 13,
    color: '#ca8a04',
  },
  reviewCountText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#92400e',
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stockPulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  stockText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#166534',
  },

  /* ── Price card ───────────────────────────────────────────────── */
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 10,
    gap: 16,
  },
  priceLeft: {
    flex: 1,
    gap: 2,
  },
  saleLabelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  saveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  saveBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  priceLabelText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  priceMain: {
    fontSize: 32,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.55)',
  },
  originalPrice: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },

  /* Quantity in price card */
  qtyBlock: {
    alignItems: 'center',
    gap: 6,
  },
  qtyLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  qtyValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
  },

  /* ── Subtotal strip ───────────────────────────────────────────── */
  subtotalStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  subtotalStripLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtotalStripAmount: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    color: '#c2410c',
    letterSpacing: -0.3,
  },

  /* ── Section ─────────────────────────────────────────────────── */
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  selectedPill: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  selectedPillText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  description: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    lineHeight: 24,
    marginTop: 10,
  },

  /* ── Chips ───────────────────────────────────────────────────── */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ff8c00',
  },
  chipText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#555',
  },
  chipTextActive: {
    color: '#c2410c',
    fontFamily: Fonts.semiBold,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },

  /* ── Info cards row ──────────────────────────────────────────── */
  infoCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26,
  },
  infoCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'flex-start',
    gap: 4,
    borderWidth: 1,
  },
  infoCardDelivery: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  infoCardReturn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  infoCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#c2410c',
  },
  infoCardLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#92400e',
    lineHeight: 17,
  },

  /* ── Vendor card ─────────────────────────────────────────────── */
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fafaf8',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0ebe4',
    marginTop: 10,
  },
  vendorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorAvatarText: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  vendorDetails: {
    flex: 1,
    gap: 4,
  },
  vendorName: {
    fontSize: 15,
    fontFamily: Fonts.display,
    color: '#1a1a1a',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
  },
  vendorRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fefce8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  vendorRatingText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#854d0e',
  },

  bottomSpacing: {
    height: 28,
  },

  /* ── Footer CTA ──────────────────────────────────────────────── */
  footer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerPriceBlock: {
    gap: 1,
  },
  footerPriceLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footerPrice: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
    letterSpacing: -0.4,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#ff8c00',
    borderRadius: 18,
    paddingVertical: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 7,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.3,
  },

  /* ── Full-screen viewer ──────────────────────────────────────── */
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.98)',
  },
  fullScreenContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 28,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 40,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
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
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  /* ── Review form modal ───────────────────────────────────────── */
  reviewFormOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewFormContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },

  rpOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rpBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  rpSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '75%',
  },
  rpHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  rpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rpIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpTitle: {
    fontSize: 16,
    fontFamily: Fonts.displayBold,
    color: '#1a1a1a',
  },
  rpProductName: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#64748b',
    marginTop: 1,
  },
  rpCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpBody: {
    marginBottom: 16,
  },
  rpNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  rpNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#1e40af',
    lineHeight: 18,
  },
  rpPolicyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
  rpFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 8,
  },
  rpFooterNoteText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    flex: 1,
  },
  rpDoneBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rpDoneBtnText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
