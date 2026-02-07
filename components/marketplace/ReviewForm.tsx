import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Review } from '@/types/database';

interface ReviewFormProps {
  productId: string;
  orderId?: string;
  existingReview?: Review;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReviewForm({
  productId,
  orderId,
  existingReview,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!existingReview;

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment || '');
    }
  }, [existingReview]);

  const handleSubmit = async () => {
    if (!profile) return;

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('reviews')
          .update({
            rating,
            comment: comment.trim() || null,
          })
          .eq('id', existingReview.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('reviews').insert({
          product_id: productId,
          user_id: profile.id,
          order_id: orderId || null,
          rating,
          comment: comment.trim() || null,
          verified_purchase: !!orderId,
        });

        if (insertError) throw insertError;
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err.message?.includes('reviews_user_product_unique')) {
        setError('You have already reviewed this product. Please edit your existing review.');
      } else {
        setError(err.message || `Failed to ${isEditing ? 'update' : 'submit'} review`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isEditing ? 'Edit Review' : 'Write a Review'}</Text>

      <View style={styles.ratingContainer}>
        <Text style={styles.label}>Your Rating</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
            >
              <Star
                size={32}
                color={star <= rating ? '#fbbf24' : '#d1d5db'}
                fill={star <= rating ? '#fbbf24' : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.commentContainer}>
        <Text style={styles.label}>Your Review (Optional)</Text>
        <TextInput
          style={styles.commentInput}
          placeholder="Share your experience with this product..."
          placeholderTextColor="#9ca3af"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        <Text style={styles.charCount}>{comment.length}/500</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonContainer}>
        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEditing ? 'Update Review' : 'Submit Review'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  ratingContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  commentContainer: {
    marginBottom: 24,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    backgroundColor: '#10b981',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
