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
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, Layers } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginSucceeded, setLoginSucceeded] = useState(false);
  const { signIn, profile, session } = useAuth();

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
    if (!loginSucceeded || !session || !profile) return;

    const needsApproval =
      (profile.role === 'vendor' || profile.role === 'rider') &&
      profile.vendor_status !== 'approved';

    if (needsApproval) {
      router.replace('/auth/vendor-pending');
    } else {
      router.replace('/hub');
    }
  }, [loginSucceeded, session, profile]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      setLoginSucceeded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#ff9a1f', '#ff8c00', '#e67a00']}
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
          <View style={styles.logoIcon}>
            <Layers size={32} color="#ff8c00" strokeWidth={2.5} />
          </View>
          <Text style={styles.brandName}>Danhausa</Text>
          <Text style={styles.brandTagline}>Logistics & Marketplace</Text>
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
              style={[styles.signInButton, loading && styles.signInButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loading ? ['#ccc', '#bbb'] : ['#ff9a1f', '#ff7b00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                {loading ? (
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    bottom: -30,
    left: -30,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
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
    color: '#ff8c00',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#999',
    marginBottom: 28,
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
    color: '#ff8c00',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  signInButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
    color: '#ff8c00',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
