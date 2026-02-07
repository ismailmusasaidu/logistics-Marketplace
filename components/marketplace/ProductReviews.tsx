import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Star, ThumbsUp, ThumbsDown, Edit2, Trash2, MessageSquare, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Review, VendorResponse, ReviewHelpfulness } from '@/types/database';

interface ExtendedReview extends Review {
  user: {
    full_name: string;
  };
  vendor_responses: VendorResponse[];
  helpfulness_stats?: {
    helpful_count: number;
    not_helpful_count: number;
    user_vote?: boolean | null;
  };
}

interface ProductReviewsProps {
  productId: string;
  vendorId: string;
  averageRating: number;
  totalReviews: number;
  onEditReview?: (review: Review) => void;
}

export default function ProductReviews({
  productId,
  vendorId,
  averageRating: propAverageRating,
  totalReviews: propTotalReviews,
  onEditReview,
}: ProductReviewsProps) {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<ExtendedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [averageRating, setAverageRating] = useState(propAverageRating);
  const [totalReviews, setTotalReviews] = useState(propTotalReviews);

  useEffect(() => {
    fetchReviews();

    const subscription = supabase
      .channel(`reviews_${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `product_id=eq.${productId}`,
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'review_helpfulness',
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [productId, profile]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(
          `
          *,
          profiles!reviews_user_id_fkey (
            full_name
          ),
          vendor_responses (
            id,
            vendor_id,
            response_text,
            created_at,
            updated_at
          )
        `
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const reviewsWithStats = await Promise.all(
        (data || []).map(async (review: any) => {
          const helpfulnessStats = await fetchHelpfulnessStats(review.id);
          return {
            ...review,
            user: {
              full_name: review.profiles?.full_name || 'Anonymous',
            },
            vendor_responses: review.vendor_responses || [],
            helpfulness_stats: helpfulnessStats,
          };
        })
      );

      setReviews(reviewsWithStats);

      const reviewCount = reviewsWithStats.length;
      const avgRating = reviewCount > 0
        ? reviewsWithStats.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;

      setTotalReviews(reviewCount);
      setAverageRating(avgRating);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpfulnessStats = async (reviewId: string) => {
    try {
      const { data, error } = await supabase
        .from('review_helpfulness')
        .select('is_helpful, user_id')
        .eq('review_id', reviewId);

      if (error) throw error;

      const helpful_count = data?.filter((v) => v.is_helpful).length || 0;
      const not_helpful_count = data?.filter((v) => !v.is_helpful).length || 0;
      const user_vote = data?.find((v) => v.user_id === profile?.id)?.is_helpful ?? null;

      return { helpful_count, not_helpful_count, user_vote };
    } catch (error) {
      console.error('Error fetching helpfulness stats:', error);
      return { helpful_count: 0, not_helpful_count: 0, user_vote: null };
    }
  };

  const handleVoteHelpfulness = async (reviewId: string, isHelpful: boolean) => {
    if (!profile) return;

    try {
      const review = reviews.find((r) => r.id === reviewId);
      const currentVote = review?.helpfulness_stats?.user_vote;

      if (currentVote === isHelpful) {
        await supabase
          .from('review_helpfulness')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', profile.id);
      } else if (currentVote !== null) {
        await supabase
          .from('review_helpfulness')
          .update({ is_helpful: isHelpful })
          .eq('review_id', reviewId)
          .eq('user_id', profile.id);
      } else {
        await supabase.from('review_helpfulness').insert({
          review_id: reviewId,
          user_id: profile.id,
          is_helpful: isHelpful,
        });
      }

      fetchReviews();
    } catch (error: any) {
      console.error('Error voting on review:', error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    Alert.alert('Delete Review', 'Are you sure you want to delete this review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
            if (error) throw error;
            fetchReviews();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete review');
          }
        },
      },
    ]);
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!profile || !responseText.trim()) return;

    try {
      setSubmittingResponse(true);
      const { error } = await supabase.from('vendor_responses').insert({
        review_id: reviewId,
        vendor_id: profile.id,
        response_text: responseText.trim(),
      });

      if (error) throw error;

      setResponseText('');
      setRespondingTo(null);
      fetchReviews();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    Alert.alert('Delete Response', 'Are you sure you want to delete this response?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('vendor_responses').delete().eq('id', responseId);
            if (error) throw error;
            fetchReviews();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete response');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const canEdit = (review: ExtendedReview) => {
    return profile?.id === review.user_id;
  };

  const canDelete = (review: ExtendedReview) => {
    return profile?.id === review.user_id || profile?.role === 'admin';
  };

  const canRespond = () => {
    return profile?.id === vendorId && profile?.role === 'vendor';
  };

  const renderVendorResponse = (response: VendorResponse) => (
    <View key={response.id} style={styles.vendorResponseCard}>
      <View style={styles.vendorResponseHeader}>
        <Text style={styles.vendorBadge}>Vendor Response</Text>
        {(profile?.id === response.vendor_id || profile?.role === 'admin') && (
          <TouchableOpacity onPress={() => handleDeleteResponse(response.id)}>
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.vendorResponseText}>{response.response_text}</Text>
      <Text style={styles.vendorResponseDate}>{formatDate(response.created_at)}</Text>
    </View>
  );

  const renderReview = ({ item }: { item: ExtendedReview }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewHeaderLeft}>
          <Text style={styles.userName}>{item.user.full_name}</Text>
          {item.verified_purchase && (
            <View style={styles.verifiedBadge}>
              <CheckCircle size={14} color="#10b981" />
              <Text style={styles.verifiedText}>Verified Purchase</Text>
            </View>
          )}
        </View>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            color={star <= item.rating ? '#fbbf24' : '#d1d5db'}
            fill={star <= item.rating ? '#fbbf24' : 'transparent'}
          />
        ))}
      </View>

      {item.comment && <Text style={styles.comment}>{item.comment}</Text>}

      <View style={styles.reviewActions}>
        <View style={styles.helpfulnessContainer}>
          <TouchableOpacity
            style={styles.helpfulButton}
            onPress={() => handleVoteHelpfulness(item.id, true)}
          >
            <ThumbsUp
              size={16}
              color={item.helpfulness_stats?.user_vote === true ? '#10b981' : '#6b7280'}
              fill={item.helpfulness_stats?.user_vote === true ? '#10b981' : 'transparent'}
            />
            <Text style={styles.helpfulCount}>{item.helpfulness_stats?.helpful_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helpfulButton}
            onPress={() => handleVoteHelpfulness(item.id, false)}
          >
            <ThumbsDown
              size={16}
              color={item.helpfulness_stats?.user_vote === false ? '#ef4444' : '#6b7280'}
              fill={item.helpfulness_stats?.user_vote === false ? '#ef4444' : 'transparent'}
            />
            <Text style={styles.helpfulCount}>{item.helpfulness_stats?.not_helpful_count || 0}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          {canRespond() && item.vendor_responses.length === 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setRespondingTo(item.id)}
            >
              <MessageSquare size={16} color="#6b7280" />
              <Text style={styles.actionButtonText}>Respond</Text>
            </TouchableOpacity>
          )}
          {canEdit(item) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEditReview && onEditReview(item)}
            >
              <Edit2 size={16} color="#6b7280" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
          {canDelete(item) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteReview(item.id)}
            >
              <Trash2 size={16} color="#ef4444" />
              <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {respondingTo === item.id && (
        <View style={styles.responseForm}>
          <TextInput
            style={styles.responseInput}
            placeholder="Write your response..."
            placeholderTextColor="#9ca3af"
            value={responseText}
            onChangeText={setResponseText}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <View style={styles.responseButtons}>
            <TouchableOpacity
              style={styles.responseCancelButton}
              onPress={() => {
                setRespondingTo(null);
                setResponseText('');
              }}
            >
              <Text style={styles.responseCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.responseSubmitButton}
              onPress={() => handleSubmitResponse(item.id)}
              disabled={submittingResponse || !responseText.trim()}
            >
              {submittingResponse ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.responseSubmitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {item.vendor_responses.map(renderVendorResponse)}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.averageRating}>
            {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                color={star <= Math.round(averageRating) ? '#fbbf24' : '#d1d5db'}
                fill={star <= Math.round(averageRating) ? '#fbbf24' : 'transparent'}
              />
            ))}
          </View>
          <Text style={styles.totalReviews}>
            {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      </View>

      {reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No reviews yet</Text>
          <Text style={styles.emptySubtext}>Be the first to review this product</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          renderItem={renderReview}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryLeft: {
    alignItems: 'center',
  },
  averageRating: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  totalReviews: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContainer: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewHeaderLeft: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  comment: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  helpfulnessContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  helpfulCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteText: {
    color: '#ef4444',
  },
  responseForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  responseButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  responseCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  responseCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  responseSubmitButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#10b981',
    minWidth: 80,
    alignItems: 'center',
  },
  responseSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  vendorResponseCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  vendorResponseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  vendorResponseText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  vendorResponseDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
