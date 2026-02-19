import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import ReviewForm from './ReviewForm';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  selected_size: string | null;
  selected_color: string | null;
  product: {
    name: string;
    image_url: string;
  };
  hasReview: boolean;
}

interface OrderItemsListProps {
  orderId: string;
  orderStatus: string;
}

export default function OrderItemsList({ orderId, orderStatus }: OrderItemsListProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderItems();
  }, [orderId]);

  const fetchOrderItems = async () => {
    try {
      setLoading(true);
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(
          `
          id,
          product_id,
          quantity,
          unit_price,
          selected_size,
          selected_color,
          products (
            name,
            image_url
          )
        `
        )
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('product_id')
        .eq('order_id', orderId);

      if (reviewsError) throw reviewsError;

      const reviewedProductIds = new Set(
        reviewsData?.map((r) => r.product_id) || []
      );

      const formattedItems = (itemsData || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        selected_size: item.selected_size || null,
        selected_color: item.selected_color || null,
        product: {
          name: item.products?.name || 'Unknown Product',
          image_url: item.products?.image_url || '',
        },
        hasReview: reviewedProductIds.has(item.product_id),
      }));

      setItems(formattedItems);
    } catch (error) {
      console.error('Error fetching order items:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (productId: string) => {
    setSelectedProductId(productId);
    setReviewModalVisible(true);
  };

  const closeReviewModal = () => {
    setReviewModalVisible(false);
    setSelectedProductId(null);
    fetchOrderItems();
  };

  const renderItem = ({ item }: { item: OrderItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.productName}>{item.product.name}</Text>
        {(item.selected_size || item.selected_color) && (
          <Text style={styles.itemVariant}>
            {[
              item.selected_size ? `Size: ${item.selected_size}` : null,
              item.selected_color ? item.selected_color : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        <Text style={styles.itemDetails}>
          {item.quantity} × ₦{item.unit_price.toFixed(2)}
        </Text>
        <Text style={styles.itemTotal}>
          ₦{(item.quantity * item.unit_price).toFixed(2)}
        </Text>
      </View>

      {orderStatus === 'delivered' && (
        <TouchableOpacity
          style={[
            styles.reviewButton,
            item.hasReview && styles.reviewButtonDisabled,
          ]}
          onPress={() => openReviewModal(item.product_id)}
          disabled={item.hasReview}
        >
          <Star
            size={16}
            color={item.hasReview ? '#9ca3af' : '#fbbf24'}
            fill={item.hasReview ? '#9ca3af' : 'transparent'}
          />
          <Text
            style={[
              styles.reviewButtonText,
              item.hasReview && styles.reviewButtonTextDisabled,
            ]}
          >
            {item.hasReview ? 'Reviewed' : 'Write Review'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#ff8c00" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
      />

      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeReviewModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedProductId && (
              <ReviewForm
                productId={selectedProductId}
                orderId={orderId}
                onSuccess={closeReviewModal}
                onCancel={closeReviewModal}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff8c00',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  reviewButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  reviewButtonTextDisabled: {
    color: '#9ca3af',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
});
