import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Star, ShoppingCart, Heart } from 'lucide-react-native';
import { Product, ProductImage } from '@/types/database';
import { supabase } from '@/lib/marketplace/supabase';
import { useWishlist } from '@/contexts/WishlistContext';
import { Fonts } from '@/constants/fonts';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onAddToCart: (e: any) => void;
}

export default function ProductCard({ product, onPress, onAddToCart }: ProductCardProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    fetchProductImages();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (images.length > 1) startAutoSlide();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [images]);

  const fetchProductImages = async () => {
    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');

      if (error) {
        console.error('Error fetching product images:', error);
        return;
      }
      if (data && data.length > 0) setImages(data);
    } catch (error) {
      console.error('Error fetching product images:', error);
    }
  };

  const startAutoSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 2000);
  };

  const displayImages = images.length > 0 ? images : [{
    id: 'default',
    image_url: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
    display_order: 0,
    is_primary: true,
    product_id: product.id,
    created_at: ''
  }];

  const isValidImageUrl = (url: string) => {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const currentImageUrl = displayImages[currentImageIndex]?.image_url;
  const isValidUrl = isValidImageUrl(currentImageUrl);
  const fallbackUrl = product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
  const hasFailed = failedImages.has(currentImageUrl);
  const finalImageUrl = (hasFailed || !isValidUrl) ? fallbackUrl : currentImageUrl;
  const inWishlist = isInWishlist(product.id);
  const hasDiscount = product.discount_active && product.discount_percentage > 0;
  const discountedPrice = hasDiscount
    ? product.price * (1 - product.discount_percentage / 100)
    : product.price;

  const handleWishlistToggle = (e: any) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: finalImageUrl }}
            style={styles.productImage}
            onError={() => {
              setFailedImages(prev => new Set(prev).add(currentImageUrl));
            }}
          />

          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{product.discount_percentage}%</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.wishlistButton, inWishlist && styles.wishlistButtonActive]}
            onPress={handleWishlistToggle}
          >
            <Heart
              size={18}
              color={inWishlist ? '#ffffff' : '#ffffff'}
              fill={inWishlist ? '#ffffff' : 'none'}
              strokeWidth={2.5}
            />
          </TouchableOpacity>

          {images.length > 1 && (
            <View style={styles.dotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentImageIndex === index && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={styles.ratingRow}>
            <Star size={13} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>
                {'\u20A6'}{discountedPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.originalPrice, !hasDiscount && styles.hidden]}>
                {'\u20A6'}{product.price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.unit}>per {product.unit}</Text>
            </View>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={onAddToCart}
              activeOpacity={0.8}
            >
              <ShoppingCart size={16} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    margin: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  imageContainer: {
    width: '100%',
    height: 170,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f5f0ea',
  },
  wishlistButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 7,
    zIndex: 10,
  },
  wishlistButtonActive: {
    backgroundColor: '#ff8c00',
  },
  productImage: {
    width: '100%',
    height: 170,
    backgroundColor: '#f0ebe4',
    resizeMode: 'cover',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  infoSection: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1a1a1a',
    marginBottom: 6,
    height: 36,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    backgroundColor: '#fef9f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  ratingText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#92400e',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  unit: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#999',
    marginTop: 1,
  },
  priceBlock: {
    justifyContent: 'flex-end',
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#999',
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  hidden: {
    opacity: 0,
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  discountBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  cartButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 11,
    padding: 10,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
