import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { coreBackend } from '@/lib/coreBackend';
import { UserRole } from '@/types/database';
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Eye,
  EyeOff,
  Layers,
  Store,
  User,
  Briefcase,
  Bike,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [accountType, setAccountType] = useState<UserRole>('customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessLicense, setBusinessLicense] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (accountType === 'vendor') {
      if (!businessName || !businessAddress || !businessPhone) {
        setError('Please fill in all business information');
        return;
      }
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const needsApproval = accountType === 'vendor' || accountType === 'rider';

      const { data: authData, error: authError } = await coreBackend.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: accountType,
            phone: phone || '',
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const updateData: any = {
          vendor_status: needsApproval ? 'pending' : 'approved',
        };

        if (accountType === 'vendor') {
          updateData.business_name = businessName;
          updateData.business_description = businessDescription || null;
          updateData.business_address = businessAddress;
          updateData.business_phone = businessPhone;
          updateData.business_license = businessLicense || null;
        }

        const { error: profileError } = await coreBackend
          .from('profiles')
          .update(updateData)
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        await new Promise(resolve => setTimeout(resolve, 500));

        if (needsApproval) {
          setError('');
          router.replace('/auth/vendor-pending');
        } else {
          router.replace('/hub');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d1a00', '#3d2200']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoIcon}>
            <Layers size={28} color="#f97316" strokeWidth={2.5} />
          </View>
          <Text style={styles.brandName}>Join Danhausa</Text>
          <Text style={styles.brandTagline}>Create your account</Text>
        </Animated.View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formSection}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>I want to</Text>
            <View style={styles.accountTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  accountType === 'customer' && styles.accountTypeActive,
                ]}
                onPress={() => setAccountType('customer')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.accountTypeIcon,
                    accountType === 'customer' && styles.accountTypeIconActive,
                  ]}
                >
                  <User
                    size={20}
                    color={accountType === 'customer' ? '#ffffff' : '#f97316'}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={[
                    styles.accountTypeText,
                    accountType === 'customer' && styles.accountTypeTextActive,
                  ]}
                >
                  Shop
                </Text>
                <Text
                  style={[
                    styles.accountTypeDesc,
                    accountType === 'customer' && styles.accountTypeDescActive,
                  ]}
                >
                  Buy products
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  accountType === 'vendor' && styles.accountTypeActive,
                ]}
                onPress={() => setAccountType('vendor')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.accountTypeIcon,
                    accountType === 'vendor' && styles.accountTypeIconActive,
                  ]}
                >
                  <Store
                    size={20}
                    color={accountType === 'vendor' ? '#ffffff' : '#f97316'}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={[
                    styles.accountTypeText,
                    accountType === 'vendor' && styles.accountTypeTextActive,
                  ]}
                >
                  Sell
                </Text>
                <Text
                  style={[
                    styles.accountTypeDesc,
                    accountType === 'vendor' && styles.accountTypeDescActive,
                  ]}
                >
                  Open a store
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  accountType === 'rider' && styles.accountTypeActive,
                ]}
                onPress={() => setAccountType('rider')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.accountTypeIcon,
                    accountType === 'rider' && styles.accountTypeIconActive,
                  ]}
                >
                  <Bike
                    size={20}
                    color={accountType === 'rider' ? '#ffffff' : '#f97316'}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={[
                    styles.accountTypeText,
                    accountType === 'rider' && styles.accountTypeTextActive,
                  ]}
                >
                  Deliver
                </Text>
                <Text
                  style={[
                    styles.accountTypeDesc,
                    accountType === 'rider' && styles.accountTypeDescActive,
                  ]}
                >
                  Become a rider
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <User size={16} color="#f97316" strokeWidth={2.5} />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#b0b0b0"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#b0b0b0"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor="#b0b0b0"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#b0b0b0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#999" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#999" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#b0b0b0"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#999" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#999" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {accountType === 'vendor' && (
              <>
                <View style={styles.sectionDivider} />

                <View style={styles.sectionHeader}>
                  <Briefcase size={16} color="#f97316" strokeWidth={2.5} />
                  <Text style={styles.sectionTitle}>Business Information</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your business name"
                    placeholderTextColor="#b0b0b0"
                    value={businessName}
                    onChangeText={setBusinessName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Tell us about your business"
                    placeholderTextColor="#b0b0b0"
                    value={businessDescription}
                    onChangeText={setBusinessDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Address *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Street address"
                    placeholderTextColor="#b0b0b0"
                    value={businessAddress}
                    onChangeText={setBusinessAddress}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Phone *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Business phone number"
                    placeholderTextColor="#b0b0b0"
                    value={businessPhone}
                    onChangeText={setBusinessPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business License</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="License number (optional)"
                    placeholderTextColor="#b0b0b0"
                    value={businessLicense}
                    onChangeText={setBusinessLicense}
                  />
                </View>

                <View style={styles.vendorNote}>
                  <Text style={styles.vendorNoteText}>
                    Your vendor account will be reviewed by our team before activation. This usually takes 24-48 hours.
                  </Text>
                </View>
              </>
            )}

            {accountType === 'rider' && (
              <View style={styles.vendorNote}>
                <Text style={styles.vendorNoteText}>
                  Your rider account will be reviewed and approved by our team. This usually takes 24-48 hours.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loading ? ['#ccc', '#bbb'] : ['#f97316', '#e85d04']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>
                    {accountType === 'vendor' || accountType === 'rider' ? 'Submit Application' : 'Create Account'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  headerGradient: {
    paddingBottom: 32,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    bottom: -30,
    left: -30,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  brandName: {
    fontSize: 30,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    letterSpacing: 0.5,
    lineHeight: 36,
  },
  brandTagline: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  formSection: {
    flex: 1,
    marginTop: -16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#888',
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  accountTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  accountTypeButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#eee',
    alignItems: 'center',
  },
  accountTypeActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  accountTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountTypeIconActive: {
    backgroundColor: '#f97316',
  },
  accountTypeText: {
    fontSize: 16,
    fontFamily: Fonts.headingBold,
    color: '#555',
  },
  accountTypeTextActive: {
    color: '#1a1a1a',
  },
  accountTypeDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#999',
    marginTop: 2,
  },
  accountTypeDescActive: {
    color: '#c2410c',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#444',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#eee',
    outlineStyle: 'none',
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1a1a1a',
    outlineStyle: 'none',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vendorNote: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  vendorNoteText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#92400e',
    lineHeight: 20,
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#bbb',
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  footerLink: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
