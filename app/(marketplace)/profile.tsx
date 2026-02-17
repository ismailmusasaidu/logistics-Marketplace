import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, Modal, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Mail, Phone, LogOut, Shield, Edit, Save, X, Store, MapPin, FileText, Wallet, Settings, ChevronRight, HelpCircle, FileCheck, Lock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/marketplace/supabase';
import WalletManagement from '@/components/marketplace/WalletManagement';
import VendorSettings from '@/components/marketplace/vendor/VendorSettings';
import { useToast } from '@/contexts/ToastContext';
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showVendorSettings, setShowVendorSettings] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [businessDescription, setBusinessDescription] = useState(profile?.business_description || '');
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address || '');
  const [businessPhone, setBusinessPhone] = useState(profile?.business_phone || '');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const avatarScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (profile) {
      fetchWalletBalance();
    }
  }, [profile]);

  const fetchWalletBalance = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (error) throw error;
      setWalletBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const confirmSignOut = () => {
    setShowSignOutConfirmation(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      showToast('Failed to sign out. Please try again.', 'error');
      setSigningOut(false);
      setShowSignOutConfirmation(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!fullName.trim()) {
      showToast('Full name is required', 'warning');
      return;
    }

    if (!email.trim()) {
      showToast('Email is required', 'warning');
      return;
    }

    if (profile.role === 'vendor' && !businessName.trim()) {
      showToast('Business name is required for vendors', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const emailChanged = email.trim() !== profile.email;

      if (emailChanged) {
        const { error: authError } = await supabase.auth.updateUser({
          email: email.trim(),
        });

        if (authError) throw authError;
      }

      const updates: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (profile.role === 'vendor') {
        updates.business_name = businessName.trim();
        updates.business_description = businessDescription.trim() || null;
        updates.business_address = businessAddress.trim() || null;
        updates.business_phone = businessPhone.trim() || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

      if (emailChanged) {
        showToast('Profile updated! Please check your new email address to confirm the change.', 'success');
      } else {
        showToast('Profile updated successfully!', 'success');
      }
      setIsEditing(false);

      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setEmail(profile?.email || '');
    setPhone(profile?.phone || '');
    setBusinessName(profile?.business_name || '');
    setBusinessDescription(profile?.business_description || '');
    setBusinessAddress(profile?.business_address || '');
    setBusinessPhone(profile?.business_phone || '');
    setIsEditing(false);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'vendor': return 'Vendor';
      case 'customer': return 'Customer';
      default: return role;
    }
  };

  if (showWallet) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#ff9a1f', '#ff8c00', '#e67a00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.subHeader, { paddingTop: insets.top + 16 }]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowWallet(false);
              fetchWalletBalance();
            }}
          >
            <ChevronRight size={20} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </LinearGradient>
        <WalletManagement />
      </View>
    );
  }

  if (showVendorSettings) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#ff9a1f', '#ff8c00', '#e67a00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.subHeader, { paddingTop: insets.top + 16 }]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowVendorSettings(false)}
          >
            <ChevronRight size={20} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </LinearGradient>
        <VendorSettings />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <LinearGradient
        colors={['#ff9a1f', '#ff8c00', '#e67a00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />

        <Animated.View style={[styles.avatarWrap, { transform: [{ scale: avatarScale }] }]}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarInitials}>{getInitials(profile?.full_name || '')}</Text>
          </View>
          <View style={styles.avatarRing} />
        </Animated.View>

        <Animated.View style={[styles.headerInfo, { opacity: fadeAnim }]}>
          <Text style={styles.name}>{profile?.full_name}</Text>
          <View style={styles.roleBadge}>
            <Shield size={12} color="#fff" strokeWidth={2.5} />
            <Text style={styles.roleText}>{getRoleLabel(profile?.role || '')}</Text>
          </View>
          {profile?.email && (
            <Text style={styles.headerEmail}>{profile.email}</Text>
          )}
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.editButtonContainer}>
          {!isEditing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ff9a1f', '#ff7b00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.editButtonGradient}
              >
                <Edit size={18} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
                activeOpacity={0.7}
              >
                <X size={18} color="#78716c" />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isSaving ? ['#ccc', '#bbb'] : ['#22c55e', '#16a34a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Save size={18} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <User size={18} color="#ff8c00" strokeWidth={2.2} />
            </View>
            <Text style={styles.cardTitle}>Personal Information</Text>
          </View>

          <InfoRow
            icon={<User size={18} color="#ff8c00" />}
            label="Full Name"
            value={profile?.full_name}
            isEditing={isEditing}
            editValue={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
          />
          <InfoRow
            icon={<Mail size={18} color="#ff8c00" />}
            label="Email Address"
            value={profile?.email}
            isEditing={isEditing}
            editValue={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <InfoRow
            icon={<Phone size={18} color="#ff8c00" />}
            label="Phone Number"
            value={profile?.phone || 'Not provided'}
            isEditing={isEditing}
            editValue={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            isLast
          />
        </View>

        {profile?.role === 'vendor' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <Store size={18} color="#ff8c00" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>Store Information</Text>
              </View>

              <InfoRow
                icon={<Store size={18} color="#ff8c00" />}
                label="Business Name"
                value={profile?.business_name || 'Not provided'}
                isEditing={isEditing}
                editValue={businessName}
                onChangeText={setBusinessName}
                placeholder="Enter business name"
              />
              <InfoRow
                icon={<Phone size={18} color="#ff8c00" />}
                label="Business Phone"
                value={profile?.business_phone || 'Not provided'}
                isEditing={isEditing}
                editValue={businessPhone}
                onChangeText={setBusinessPhone}
                placeholder="Enter business phone"
                keyboardType="phone-pad"
              />
              <InfoRow
                icon={<MapPin size={18} color="#ff8c00" />}
                label="Business Address"
                value={profile?.business_address || 'Not provided'}
                isEditing={isEditing}
                editValue={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="Enter business address"
                multiline
              />
              <InfoRow
                icon={<FileText size={18} color="#ff8c00" />}
                label="Business Description"
                value={profile?.business_description || 'Not provided'}
                isEditing={isEditing}
                editValue={businessDescription}
                onChangeText={setBusinessDescription}
                placeholder="Describe your business"
                multiline
                isLast
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <Settings size={18} color="#ff8c00" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>Vendor Settings</Text>
              </View>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => setShowVendorSettings(true)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#fff7ed', '#fff1e0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionCardInner}
                >
                  <View style={styles.actionCardIcon}>
                    <Settings size={22} color="#e67a00" strokeWidth={2} />
                  </View>
                  <View style={styles.actionCardInfo}>
                    <Text style={styles.actionCardLabel}>Store Settings</Text>
                    <Text style={styles.actionCardDesc}>Delivery, payments, hours & more</Text>
                  </View>
                  <ChevronRight size={20} color="#e67a00" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Wallet size={18} color="#ff8c00" strokeWidth={2.2} />
            </View>
            <Text style={styles.cardTitle}>My Wallet</Text>
          </View>
          <TouchableOpacity
            style={styles.walletCard}
            onPress={() => setShowWallet(true)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#2d1f12', '#3d2915']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletCardInner}
            >
              <View style={styles.walletCardLeft}>
                <View style={styles.walletIconWrap}>
                  <Wallet size={22} color="#ff8c00" strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.walletLabel}>Available Balance</Text>
                  <Text style={styles.walletAmount}>{'\u20A6'}{walletBalance.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.walletCta}>
                <Text style={styles.walletCtaText}>Manage</Text>
                <ChevronRight size={16} color="#ff8c00" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <HelpCircle size={18} color="#ff8c00" strokeWidth={2.2} />
            </View>
            <Text style={styles.cardTitle}>Support</Text>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/help-center')}
            activeOpacity={0.6}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <HelpCircle size={18} color="#78716c" strokeWidth={2} />
              </View>
              <Text style={styles.menuText}>Help Center</Text>
            </View>
            <ChevronRight size={18} color="#d6d3d1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/terms-of-service')}
            activeOpacity={0.6}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <FileCheck size={18} color="#78716c" strokeWidth={2} />
              </View>
              <Text style={styles.menuText}>Terms of Service</Text>
            </View>
            <ChevronRight size={18} color="#d6d3d1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => router.push('/privacy-policy')}
            activeOpacity={0.6}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <Lock size={18} color="#78716c" strokeWidth={2} />
              </View>
              <Text style={styles.menuText}>Privacy Policy</Text>
            </View>
            <ChevronRight size={18} color="#d6d3d1" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={confirmSignOut}
          activeOpacity={0.7}
        >
          <LogOut size={20} color="#ef4444" strokeWidth={2.2} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={showSignOutConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIcon}>
              <LogOut size={28} color="#ef4444" strokeWidth={2} />
            </View>
            <Text style={styles.confirmationTitle}>Sign Out</Text>
            <Text style={styles.confirmationMessage}>
              Are you sure you want to sign out of your account?
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowSignOutConfirmation(false)}
                disabled={signingOut}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSignOutBtn}
                onPress={handleSignOut}
                disabled={signingOut}
                activeOpacity={0.85}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmSignOutText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isEditing,
  editValue,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  isEditing: boolean;
  editValue: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
  multiline?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoIconWrap}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={[
              styles.infoInput,
              multiline && styles.infoInputMultiline,
              Platform.OS === 'web' && { outlineStyle: 'none' } as any,
            ]}
            value={editValue}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#b0b0b0"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
          />
        ) : (
          <Text style={[styles.infoValue, (!value || value === 'Not provided') && styles.infoValueEmpty]}>
            {value || 'Not provided'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    top: -70,
    right: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -40,
    left: -40,
  },
  decorCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    top: 40,
    left: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 54,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  avatarInitials: {
    fontSize: 36,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    letterSpacing: 1,
  },
  headerInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 28,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
  },
  roleText: {
    fontSize: 11,
    fontFamily: Fonts.groteskSemiBold,
    color: '#ffffff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerEmail: {
    fontSize: 14,
    fontFamily: Fonts.grotesk,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  subHeader: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.groteskMedium,
  },
  content: {
    marginTop: -24,
    paddingHorizontal: 16,
  },
  editButtonContainer: {
    marginBottom: 16,
  },
  editButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
  },
  cancelBtnText: {
    color: '#78716c',
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
  },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: Fonts.heading,
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: Fonts.groteskSemiBold,
    color: '#a8a29e',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: Fonts.groteskMedium,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  infoValueEmpty: {
    color: '#d6d3d1',
    fontStyle: 'italic',
  },
  infoInput: {
    fontSize: 15,
    fontFamily: Fonts.grotesk,
    color: '#1a1a1a',
    backgroundColor: '#faf8f5',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    marginTop: 2,
  },
  infoInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  actionCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardInfo: {
    flex: 1,
  },
  actionCardLabel: {
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
    color: '#92400e',
    marginBottom: 2,
  },
  actionCardDesc: {
    fontSize: 13,
    fontFamily: Fonts.grotesk,
    color: '#b45309',
    opacity: 0.7,
  },
  walletCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  walletCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
  },
  walletCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  walletIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 11,
    fontFamily: Fonts.groteskSemiBold,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  walletAmount: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
  },
  walletCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  walletCtaText: {
    fontSize: 13,
    fontFamily: Fonts.groteskSemiBold,
    color: '#ff8c00',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  menuItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#faf8f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 15,
    fontFamily: Fonts.groteskMedium,
    color: '#44403c',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    marginBottom: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: Fonts.groteskSemiBold,
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmationModal: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  confirmationIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 22,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmationMessage: {
    fontSize: 15,
    fontFamily: Fonts.grotesk,
    color: '#78716c',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f4',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  confirmCancelText: {
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
    color: '#78716c',
  },
  confirmSignOutBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
  confirmSignOutText: {
    fontSize: 15,
    fontFamily: Fonts.groteskSemiBold,
    color: '#ffffff',
  },
});
