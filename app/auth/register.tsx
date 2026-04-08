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
import { supabase } from '@/lib/supabase';
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
  Mail,
  CircleCheck,
  Car,
} from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VEHICLE_TYPES = [
  { value: 'bike', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van/Truck' },
];

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
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 8) { setOtpError('Please enter the 8-digit code'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      });
      if (verifyError) throw verifyError;
      const needsApproval = accountType === 'vendor' || accountType === 'rider';
      router.replace(needsApproval ? '/auth/vendor-pending' : '/auth/login');
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('invalid') || err.message?.toLowerCase().includes('expired')) {
        setOtpError('Invalid or expired code. Please try again or resend.');
      } else {
        setOtpError(err.message || 'Failed to verify code');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) throw resendError;
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    } finally {
      setOtpLoading(false);
    }
  };

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

    if (accountType === 'rider') {
      if (!vehicleNumber || !licenseNumber) {
        setError('Please fill in your vehicle and license information');
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

      const emailRedirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/auth/confirm`
        : 'danhausa://auth/confirm';

      const signUpMetadata: Record<string, string> = {
        full_name: fullName,
        role: accountType,
        phone: phone || '',
        vendor_status: needsApproval ? 'pending' : 'approved',
      };

      if (accountType === 'vendor') {
        signUpMetadata.business_name = businessName;
        if (businessDescription) signUpMetadata.business_description = businessDescription;
        signUpMetadata.business_address = businessAddress;
        signUpMetadata.business_phone = businessPhone;
        if (businessLicense) signUpMetadata.business_license = businessLicense;
      }

      if (accountType === 'rider') {
        signUpMetadata.vehicle_type = vehicleType;
        signUpMetadata.vehicle_number = vehicleNumber;
        signUpMetadata.license_number = licenseNumber;
      }

      const { data: authData, error: authError } = await coreBackend.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: signUpMetadata,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        setRegistered(true);
        setResendCooldown(60);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#2d1a00', '#3d2200']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <CircleCheck size={28} color="#f97316" strokeWidth={2.5} />
            </View>
            <Text style={styles.brandName}>Verify Your Email</Text>
            <Text style={styles.brandTagline}>One last step to activate your account</Text>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.confirmCard}>
              <View style={styles.otpEmailBadge}>
                <Mail size={16} color="#f97316" strokeWidth={2} />
                <Text style={styles.otpEmailText}>
                  Code sent to <Text style={styles.otpEmailBold}>{email}</Text>
                </Text>
              </View>

              {otpError ? (
                <View style={styles.otpErrorBox}>
                  <Text style={styles.otpErrorText}>{otpError}</Text>
                </View>
              ) : null}

              <Text style={styles.otpLabel}>8-Digit Verification Code</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="00000000"
                placeholderTextColor="#b0b0b0"
                value={otp}
                onChangeText={t => setOtp(t.replace(/[^0-9]/g, '').slice(0, 8))}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.confirmSignInBtn, (otpLoading || otp.length < 8) && styles.confirmSignInBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={otpLoading || otp.length < 8}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={(otpLoading || otp.length < 8) ? ['#ccc', '#bbb'] : ['#f97316', '#e85d04']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmSignInGradient}
                >
                  {otpLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.confirmSignInText}>Verify & Activate</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendCode}
                disabled={resendCooldown > 0 || otpLoading}
              >
                <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive a code? Resend"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace('/auth/login')} style={styles.skipBtn}>
                <Text style={styles.skipText}>Verify later — Go to Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

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
              <>
                <View style={styles.sectionDivider} />

                <View style={styles.sectionHeader}>
                  <Car size={16} color="#f97316" strokeWidth={2.5} />
                  <Text style={styles.sectionTitle}>Vehicle Information</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Type *</Text>
                  <View style={styles.vehicleTypeRow}>
                    {VEHICLE_TYPES.map((vt) => (
                      <TouchableOpacity
                        key={vt.value}
                        style={[styles.vehicleTypeBtn, vehicleType === vt.value && styles.vehicleTypeBtnActive]}
                        onPress={() => setVehicleType(vt.value)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.vehicleTypeBtnText, vehicleType === vt.value && styles.vehicleTypeBtnTextActive]}>
                          {vt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ABC-123-XY"
                    placeholderTextColor="#b0b0b0"
                    value={vehicleNumber}
                    onChangeText={setVehicleNumber}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>License Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your driver's license number"
                    placeholderTextColor="#b0b0b0"
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.vendorNote}>
                  <Text style={styles.vendorNoteText}>
                    Your rider application will be reviewed by our team before activation. This usually takes 24-48 hours.
                  </Text>
                </View>
              </>
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
  confirmContainer: {
    flex: 1,
  },
  confirmCard: {
    marginTop: -16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  otpEmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  otpEmailText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#9a3412',
    flex: 1,
  },
  otpEmailBold: {
    fontFamily: Fonts.semiBold,
    color: '#c2410c',
  },
  otpErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  otpErrorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  otpLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#444',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  otpInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 16,
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#eee',
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: 20,
    outlineStyle: 'none' as any,
  },
  confirmSignInBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  resendBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  resendText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  resendTextDisabled: {
    color: '#bbb',
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    color: '#aaa',
    fontSize: 13,
    fontFamily: Fonts.regular,
  },
  confirmIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 26,
    fontFamily: Fonts.playfairBold,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  confirmBody: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmEmail: {
    fontFamily: Fonts.semiBold,
    color: '#f97316',
  },
  confirmHint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#888',
    textAlign: 'center',
    lineHeight: 19,
  },
  confirmSignInBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmSignInGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  confirmSignInText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
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
    outlineStyle: 'none' as any,
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
    outlineStyle: 'none' as any,
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  vehicleTypeBtnActive: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  vehicleTypeBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#555',
  },
  vehicleTypeBtnTextActive: {
    color: '#c2410c',
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
