import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { coreBackend } from '@/lib/coreBackend';
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, Mail, Truck, ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { signIn, profile, session, loading } = useAuth();

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
    if (loading) return;
    if (!session) return;
    if (!profile) return;

    const needsApproval =
      (profile.role === 'vendor' || profile.role === 'rider') &&
      profile.vendor_status !== 'approved';

    if (needsApproval) {
      router.replace('/auth/vendor-pending');
    } else if (profile.role === 'vendor') {
      router.replace('/(marketplace)');
    } else if (profile.role === 'rider') {
      router.replace('/(logistics)/rider-home');
    } else {
      router.replace('/hub');
    }
  }, [session, profile, loading]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setSigningIn(true);
    setError('');
    setEmailUnconfirmed(false);
    setResendSuccess(false);

    try {
      await signIn(email, password);
    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('email_not_confirmed')) {
        setEmailUnconfirmed(true);
      } else {
        setError(msg || 'Failed to sign in');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const { error: resendError } = await coreBackend.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) throw resendError;
      setResendSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to resend confirmation email');
    } finally {
      setResendLoading(false);
    }
  };

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

        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoDualWrapper}>
            <View style={styles.logoIconBox}>
              <Truck size={28} color="#ffffff" strokeWidth={1.8} />
              <Text style={styles.logoIconLabel}>Logistics</Text>
            </View>
            <View style={styles.logoDivider} />
            <View style={styles.logoIconBox}>
              <ShoppingBag size={28} color="#ffffff" strokeWidth={1.8} />
              <Text style={styles.logoIconLabel}>Marketplace</Text>
            </View>
          </View>
          <Text style={styles.brandName}>Danhausa</Text>
          <Text style={styles.brandSlogan}>Your world, delivered.</Text>
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
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeAccent}>Good to see you again</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to continue your journey</Text>

            {emailUnconfirmed && (
              <View style={styles.confirmBox}>
                <View style={styles.confirmBoxHeader}>
                  <Mail size={20} color="#d97706" />
                  <Text style={styles.confirmBoxTitle}>Email Not Confirmed</Text>
                </View>
                <Text style={styles.confirmBoxText}>
                  Please check your inbox and click the confirmation link before signing in.
                </Text>
                {resendSuccess ? (
                  <Text style={styles.confirmBoxSent}>Confirmation email sent! Check your inbox.</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResendConfirmation}
                    disabled={resendLoading}
                  >
                    {resendLoading ? (
                      <ActivityIndicator size="small" color="#d97706" />
                    ) : (
                      <Text style={styles.resendButtonText}>Resend Confirmation Email</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
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
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
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

            <Link href="/auth/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.signInButton, signingIn && styles.signInButtonDisabled]}
              onPress={handleLogin}
              disabled={signingIn}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={signingIn ? ['#ccc', '#bbb'] : ['#f97316', '#e85d04']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                {signingIn ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.signInText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.signUpLink}>Sign Up</Text>
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
    paddingBottom: 40,
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
  logoDualWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 0,
  },
  logoIconBox: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logoIconLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 5,
    fontFamily: Fonts.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  logoDivider: {
    width: 1.5,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  brandName: {
    fontSize: 38,
    fontFamily: Fonts.playfairBold,
    color: '#ffffff',
    letterSpacing: 1,
    lineHeight: 46,
  },
  brandTagline: {
    fontSize: 11,
    fontFamily: Fonts.spaceMedium,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  brandSlogan: {
    fontSize: 14,
    fontFamily: Fonts.playfairItalic,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  formSection: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 28,
    fontFamily: Fonts.playfairBold,
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  welcomeAccent: {
    fontSize: 14,
    fontFamily: Fonts.playfairItalic,
    color: '#f97316',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#999',
    marginBottom: 28,
  },
  confirmBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  confirmBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBoxTitle: {
    color: '#92400e',
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  confirmBoxText: {
    color: '#78350f',
    fontSize: 13,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  confirmBoxSent: {
    color: '#15803d',
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  resendButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcd34d',
    minWidth: 48,
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#d97706',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
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
  inputGroup: {
    marginBottom: 18,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#f97316',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  signInButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  signInGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  signInText: {
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
  signUpLink: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
