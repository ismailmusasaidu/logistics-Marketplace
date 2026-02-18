import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
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
      if (error) { console.error('Error fetching product images:', error); return; }
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

  const isValidImageUrl = (url: string) => url && (url.startsWith('http://') || url.startsWith('https://'));

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
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: finalImageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => {
            setFailedImages(prev => new Set(prev).add(currentImageUrl));
          }}
        />

        {hasDiscount && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>-{product.discount_percentage}%</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.heartBtn, inWishlist && styles.heartBtnActive]}
          onPress={handleWishlistToggle}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Heart
            size={15}
            color="#ffffff"
            fill={inWishlist ? '#ffffff' : 'none'}
            strokeWidth={2.5}
          />
        </TouchableOpacity>

        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentImageIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

        <View style={styles.ratingPill}>
          <Star size={11} color="#f59e0b" fill="#f59e0b" />
          <Text style={styles.ratingValue}>{product.rating.toFixed(1)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.priceGroup}>
            <Text style={styles.price}>
              {'\u20A6'}{discountedPrice.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>
                {'\u20A6'}{product.price.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
            )}
            <Text style={styles.unit}>/{product.unit}</Text>
          </View>

          <TouchableOpacity
            style={styles.cartBtn}
            onPress={onAddToCart}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <ShoppingCart size={14} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    margin: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#efefef',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 3,
        }),
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f7f7f7',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  saleBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
  },
  saleBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  heartBtnActive: {
    backgroundColor: '#ef4444',
  },
  dots: {
    position: 'absolute',
    bottom: 7,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 14,
    backgroundColor: '#ffffff',
  },
  body: {
    padding: 10,
    paddingTop: 9,
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#111111',
    lineHeight: 18,
    minHeight: 36,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  ratingValue: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#92400e',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceGroup: {
    flex: 1,
    gap: 1,
  },
  price: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#0f0f0f',
    letterSpacing: -0.2,
  },
  originalPrice: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#c0c0c0',
    textDecorationLine: 'line-through',
  },
  unit: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#b0b0b0',
  },
  cartBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(249,115,22,0.35)' }
      : {
          shadowColor: '#f97316',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 5,
          elevation: 3,
        }),
  },
});
