import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { User, Mail, LogOut, Edit, Save, X, Phone, Calendar, Bike, FileText, Hash, Star, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Fonts } from '@/constants/fonts';

interface RiderInfo {
  id: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  zone_id: string | null;
}

interface RiderReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
  order_ref: string;
}

interface ReviewStats {
  total: number;
  average: number;
  star5: number;
  star4: number;
  star3: number;
  star2: number;
  star1: number;
}

export default function RiderProfile() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [riderInfo, setRiderInfo] = useState<RiderInfo | null>(null);
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reviews, setReviews] = useState<RiderReview[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ total: 0, average: 0, star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 });
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data: riderRow } = await supabase
        .from('riders')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!riderRow) return;

      const { data, error: rErr } = await supabase
        .from('ratings')
        .select('id, rating, comment, created_at, customer_id, order_id')
        .eq('rider_id', riderRow.id)
        .order('created_at', { ascending: false });

      if (rErr || !data) return;

      const enriched: RiderReview[] = await Promise.all(
        data.map(async (r) => {
          const [custRes] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('id', r.customer_id).maybeSingle(),
          ]);
          return {
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            customer_name: custRes.data?.full_name || 'Customer',
            order_ref: r.order_id.slice(0, 8).toUpperCase(),
          };
        })
      );

      setReviews(enriched);
      const total = enriched.length;
      const avg = total > 0 ? enriched.reduce((s, r) => s + r.rating, 0) / total : 0;
      setReviewStats({
        total,
        average: Math.round(avg * 10) / 10,
        star5: enriched.filter(r => r.rating === 5).length,
        star4: enriched.filter(r => r.rating === 4).length,
        star3: enriched.filter(r => r.rating === 3).length,
        star2: enriched.filter(r => r.rating === 2).length,
        star1: enriched.filter(r => r.rating === 1).length,
      });
    } catch (e) {
      console.error('Error loading reviews:', e);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadRiderInfo();
    loadReviews();
  }, [profile?.id]);

  const loadRiderInfo = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRiderInfo(data);
        setVehicleType(data.vehicle_type);
        setVehicleNumber(data.vehicle_number);
        setLicenseNumber(data.license_number);
      }
    } catch (err) {
      console.error('Error loading rider info:', err);
    }
  };

  const handleEdit = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    if (riderInfo) {
      setVehicleType(riderInfo.vehicle_type);
      setVehicleNumber(riderInfo.vehicle_number);
      setLicenseNumber(riderInfo.license_number);
    }
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    if (riderInfo) {
      setVehicleType(riderInfo.vehicle_type);
      setVehicleNumber(riderInfo.vehicle_number);
      setLicenseNumber(riderInfo.license_number);
    }
    setError(null);
    setSuccess(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    if (!vehicleNumber.trim() || !licenseNumber.trim()) {
      setError('Vehicle number and license number are required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      if (riderInfo) {
        const { error: riderError } = await supabase
          .from('riders')
          .update({
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber.trim(),
            license_number: licenseNumber.trim(),
          })
          .eq('id', riderInfo.id);

        if (riderError) throw riderError;
      } else {
        const { error: riderError } = await supabase
          .from('riders')
          .insert({
            user_id: profile.id,
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber.trim(),
            license_number: licenseNumber.trim(),
          });

        if (riderError) throw riderError;
      }

      await refreshProfile();
      await loadRiderInfo();
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to sign out?')
      : true;

    if (confirmed) {
      try {
        console.log('Rider profile: Starting sign out...');
        await signOut();
        console.log('Rider profile: Sign out complete, redirecting...');
        router.replace('/auth/login');
      } catch (error) {
        console.error('Rider profile: Error signing out:', error);
        if (Platform.OS === 'web') {
          alert('Failed to sign out: ' + (error as Error).message);
        }
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          {!isEditing && (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Edit size={24} color="#f97316" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={48} color="#ffffff" />
            </View>
          </View>

          {isEditing ? (
            <View style={styles.editSection}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                editable={!loading}
              />
            </View>
          ) : (
            <>
              <Text style={styles.name}>{profile?.full_name || 'No name set'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Rider</Text>
              </View>

              <TouchableOpacity style={styles.editProfileButton} onPress={handleEdit}>
                <Edit size={18} color="#f97316" />
                <Text style={styles.editProfileButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Mail size={20} color="#f97316" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Phone size={20} color="#f97316" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.inputInline}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter your phone number"
                    editable={!loading}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.infoValue}>{profile?.phone || 'Not provided'}</Text>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <User size={20} color="#f97316" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>{profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Calendar size={20} color="#f97316" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>

          {!riderInfo && !isEditing && (
            <View style={styles.setupPrompt}>
              <Bike size={48} color="#f97316" />
              <Text style={styles.setupPromptTitle}>Complete Your Rider Profile</Text>
              <Text style={styles.setupPromptText}>
                Add your vehicle information to get assigned to delivery zones and start receiving orders.
              </Text>
              <TouchableOpacity style={styles.setupPromptButton} onPress={handleEdit}>
                <Text style={styles.setupPromptButtonText}>Add Vehicle Info</Text>
              </TouchableOpacity>
            </View>
          )}

          {(riderInfo || isEditing) && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Bike size={20} color="#f97316" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Vehicle Type</Text>
                  {isEditing ? (
                    <View style={styles.vehicleTypeContainer}>
                      {['bike', 'motorcycle', 'car', 'van'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.vehicleTypeButton,
                            vehicleType === type && styles.vehicleTypeButtonActive
                          ]}
                          onPress={() => setVehicleType(type)}
                          disabled={loading}
                        >
                          <Text style={[
                            styles.vehicleTypeText,
                            vehicleType === type && styles.vehicleTypeTextActive
                          ]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.infoValue}>
                      {riderInfo?.vehicle_type ? riderInfo.vehicle_type.charAt(0).toUpperCase() + riderInfo.vehicle_type.slice(1) : 'Not set'}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Hash size={20} color="#f97316" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Vehicle Number</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.inputInline}
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                      placeholder="Enter vehicle number/plate"
                      editable={!loading}
                    />
                  ) : (
                    <Text style={styles.infoValue}>{riderInfo?.vehicle_number || 'Not set'}</Text>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <FileText size={20} color="#f97316" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>License Number</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.inputInline}
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      placeholder="Enter driver's license number"
                      editable={!loading}
                    />
                  ) : (
                    <Text style={styles.infoValue}>{riderInfo?.license_number || 'Not set'}</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {isEditing && (
          <View style={styles.section}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                <X size={20} color="#ef4444" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Save size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.reviewsSectionHeader}
            onPress={() => setReviewsExpanded(!reviewsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.reviewsSectionLeft}>
              <View style={styles.reviewsIconBadge}>
                <Star size={18} color="#f97316" fill="#f97316" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>My Reviews</Text>
                <Text style={styles.reviewsSubtitle}>
                  {reviewStats.total > 0
                    ? `${reviewStats.average.toFixed(1)} avg · ${reviewStats.total} review${reviewStats.total !== 1 ? 's' : ''}`
                    : 'No reviews yet'}
                </Text>
              </View>
            </View>
            {reviewsExpanded ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </TouchableOpacity>

          {reviewsExpanded && (
            <View style={styles.reviewsBody}>
              {reviewStats.total > 0 && (
                <View style={styles.reviewsStatsCard}>
                  <View style={styles.reviewsStatsLeft}>
                    <Text style={styles.reviewsAvgScore}>{reviewStats.average.toFixed(1)}</Text>
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star
                          key={i}
                          size={16}
                          color="#f59e0b"
                          fill={i <= Math.round(reviewStats.average) ? '#f59e0b' : 'transparent'}
                        />
                      ))}
                    </View>
                    <Text style={styles.reviewsAvgLabel}>{reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.reviewsStatsRight}>
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = reviewStats[`star${star}` as keyof ReviewStats] as number;
                      const pct = reviewStats.total > 0 ? Math.max((count / reviewStats.total) * 100, count > 0 ? 4 : 0) : 0;
                      return (
                        <View key={star} style={styles.reviewsBarRow}>
                          <Text style={styles.reviewsBarLabel}>{star}</Text>
                          <Star size={9} color="#f59e0b" fill="#f59e0b" />
                          <View style={styles.reviewsBarTrack}>
                            <View style={[styles.reviewsBarFill, { width: `${pct}%` as any }]} />
                          </View>
                          <Text style={styles.reviewsBarCount}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {reviews.length === 0 ? (
                <View style={styles.reviewsEmpty}>
                  <Star size={40} color="#e5e7eb" />
                  <Text style={styles.reviewsEmptyText}>No reviews yet</Text>
                  <Text style={styles.reviewsEmptySubtext}>Customers will be able to rate you after each delivery</Text>
                </View>
              ) : (
                reviews.map(review => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardTop}>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={14} color="#f59e0b" fill={i <= review.rating ? '#f59e0b' : 'transparent'} />
                        ))}
                      </View>
                      <Text style={styles.reviewCardDate}>
                        {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </Text>
                    </View>
                    {review.comment ? (
                      <View style={styles.reviewCommentBox}>
                        <MessageSquare size={13} color="#9ca3af" />
                        <Text style={styles.reviewCommentText}>"{review.comment}"</Text>
                      </View>
                    ) : (
                      <Text style={styles.reviewNoComment}>No comment left</Text>
                    )}
                    <Text style={styles.reviewCustomer}>— {review.customer_name} · Order #{review.order_ref}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.5,
  },
  editButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fed7aa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#d1fae5',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
  },
  successText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    margin: 24,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  roleBadge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  roleText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    letterSpacing: 0.5,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fed7aa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  editProfileButtonText: {
    color: '#f97316',
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fed7aa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontFamily: Fonts.poppinsMedium,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  signOutText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ef4444',
  },
  editSection: {
    width: '100%',
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  inputInline: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ef4444',
  },
  saveButton: {
    backgroundColor: '#f97316',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
  setupPrompt: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  setupPromptTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  setupPromptText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  setupPromptButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  setupPromptButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  vehicleTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  vehicleTypeButtonActive: {
    borderColor: '#f97316',
    backgroundColor: '#fed7aa',
  },
  vehicleTypeText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsMedium,
    color: '#6b7280',
  },
  vehicleTypeTextActive: {
    color: '#f97316',
    fontFamily: Fonts.poppinsBold,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewsSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewsIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  reviewsSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginTop: 2,
  },
  reviewsBody: {
    marginTop: 10,
    gap: 10,
  },
  reviewsStatsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewsStatsLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    gap: 4,
  },
  reviewsAvgScore: {
    fontSize: 36,
    fontWeight: '800',
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    lineHeight: 42,
  },
  reviewsAvgLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: Fonts.poppinsRegular,
    textAlign: 'center',
  },
  reviewsStatsRight: {
    flex: 1,
    gap: 5,
    justifyContent: 'center',
  },
  reviewsBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reviewsBarLabel: {
    fontSize: 11,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    width: 10,
    textAlign: 'right',
  },
  reviewsBarTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  reviewsBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  reviewsBarCount: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    width: 18,
    textAlign: 'right',
  },
  reviewsEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  reviewsEmptyText: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
    color: '#374151',
  },
  reviewsEmptySubtext: {
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewCardDate: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: Fonts.poppinsRegular,
  },
  reviewCommentBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#f59e0b',
  },
  reviewCommentText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontFamily: Fonts.poppinsRegular,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  reviewNoComment: {
    fontSize: 12,
    color: '#d1d5db',
    fontFamily: Fonts.poppinsRegular,
    fontStyle: 'italic',
  },
  reviewCustomer: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
  },
});
