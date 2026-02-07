import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Star, Trash2, Search, X, CheckCircle, MessageSquare } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Review, VendorResponse } from '@/types/database';
import { useToast } from '@/contexts/ToastContext';

interface ExtendedReview extends Review {
  user: {
    full_name: string;
    email: string;
  };
  product: {
    name: string;
    vendor_id: string;
  };
  vendor_responses: VendorResponse[];
}

export default function ReviewModeration() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<ExtendedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();

    const subscription = supabase
      .channel('admin_reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
        },
        () => {
          fetchReviews();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_responses',
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!reviews_user_id_fkey (
            full_name,
            email
          ),
          products (
            name,
            vendor_id
          ),
          vendor_responses (
            id,
            vendor_id,
            response_text,
            created_at
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedReviews = (data || []).map((review: any) => ({
        ...review,
        user: {
          full_name: review.profiles?.full_name || 'Unknown',
          email: review.profiles?.email || 'Unknown',
        },
        product: {
          name: review.products?.name || 'Unknown Product',
          vendor_id: review.products?.vendor_id || '',
        },
        vendor_responses: review.vendor_responses || [],
      }));

      setReviews(formattedReviews);
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      showToast(error.message || 'Failed to fetch reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(reviewId);
              const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('id', reviewId);

              if (error) throw error;

              showToast('Review deleted successfully', 'success');
              fetchReviews();
            } catch (error: any) {
              console.error('Error deleting review:', error);
              showToast(error.message || 'Failed to delete review', 'error');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteResponse = async (responseId: string) => {
    Alert.alert(
      'Delete Vendor Response',
      'Are you sure you want to delete this vendor response?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vendor_responses')
                .delete()
                .eq('id', responseId);

              if (error) throw error;

              showToast('Vendor response deleted successfully', 'success');
              fetchReviews();
            } catch (error: any) {
              console.error('Error deleting response:', error);
              showToast(error.message || 'Failed to delete response', 'error');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredReviews = reviews.filter((review) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const userName = review.user.full_name.toLowerCase();
    const userEmail = review.user.email.toLowerCase();
    const productName = review.product.name.toLowerCase();
    const comment = (review.comment || '').toLowerCase();

    return (
      userName.includes(query) ||
      userEmail.includes(query) ||
      productName.includes(query) ||
      comment.includes(query)
    );
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Review Moderation</Text>
        <Text style={styles.subtitle}>
          {reviews.length} total reviews
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#6b7280" />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder="Search reviews by user, product, or content..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {filteredReviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Star size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No reviews found' : 'No reviews yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try adjusting your search'
              : 'Reviews will appear here when customers submit them'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewHeaderLeft}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.user.full_name}</Text>
                    {item.verified_purchase && (
                      <View style={styles.verifiedBadge}>
                        <CheckCircle size={12} color="#10b981" />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userEmail}>{item.user.email}</Text>
                  <Text style={styles.productName}>{item.product.name}</Text>
                </View>
                <View style={styles.reviewHeaderRight}>
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        color={star <= item.rating ? '#fbbf24' : '#d1d5db'}
                        fill={star <= item.rating ? '#fbbf24' : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                </View>
              </View>

              {item.comment && (
                <View style={styles.commentContainer}>
                  <Text style={styles.comment}>{item.comment}</Text>
                </View>
              )}

              {item.vendor_responses.length > 0 && (
                <View style={styles.responsesContainer}>
                  <View style={styles.responsesHeader}>
                    <MessageSquare size={16} color="#10b981" />
                    <Text style={styles.responsesTitle}>
                      Vendor Response ({item.vendor_responses.length})
                    </Text>
                  </View>
                  {item.vendor_responses.map((response) => (
                    <View key={response.id} style={styles.responseCard}>
                      <Text style={styles.responseText}>{response.response_text}</Text>
                      <View style={styles.responseFooter}>
                        <Text style={styles.responseDate}>
                          {formatDate(response.created_at)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteResponse(response.id)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    deleting === item.id && styles.deleteButtonDisabled,
                  ]}
                  onPress={() => handleDeleteReview(item.id)}
                  disabled={deleting === item.id}
                >
                  {deleting === item.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#ffffff" />
                      <Text style={styles.deleteButtonText}>Delete Review</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  reviewHeaderLeft: {
    flex: 1,
  },
  reviewHeaderRight: {
    alignItems: 'flex-end',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
  },
  userEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    color: '#ff8c00',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  date: {
    fontSize: 11,
    color: '#9ca3af',
  },
  commentContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  comment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  responsesContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  responsesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responsesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    textTransform: 'uppercase',
  },
  responseCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  responseText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 6,
  },
  responseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  responseDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 6,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
