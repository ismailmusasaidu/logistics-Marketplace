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
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, KeyRound } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;

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
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#ff9a1f', '#ff8c00', '#e67a00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <Animated.View
            style={[
              styles.successIconWrap,
              { transform: [{ scale: iconScale }] },
            ]}
          >
            <View style={styles.successIconCircle}>
              <Mail size={40} color="#ff8c00" strokeWidth={2} />
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.headerTitle}>Check Your Email</Text>
            <Text style={styles.headerSubtitle}>
              We've sent a password reset link
            </Text>
          </Animated.View>
        </LinearGradient>

        <Animated.View
          style={[
            styles.successBody,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.successCard}>
            <View style={styles.emailSentBadge}>
              <Mail size={18} color="#ff8c00" strokeWidth={2} />
              <Text style={styles.emailSentText}>{email}</Text>
            </View>

            <Text style={styles.successMessage}>
              Please check your inbox and click the reset link to create a new password.
            </Text>

            <Text style={styles.successHint}>
              Didn't receive the email? Check your spam folder or try again.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ff9a1f', '#ff7b00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>Back to Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setSuccess(false)}
            >
              <Text style={styles.retryButtonText}>Try a different email</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#ff9a1f', '#ff8c00', '#e67a00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <Animated.View style={[styles.headerContent, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.headerIconWrap,
              { transform: [{ scale: iconScale }] },
            ]}
          >
            <View style={styles.headerIconCircle}>
              <KeyRound size={32} color="#ff8c00" strokeWidth={2} />
            </View>
          </Animated.View>

          <Text style={styles.headerTitle}>Forgot Password?</Text>
          <Text style={styles.headerSubtitle}>
            No worries, we'll send you reset instructions
          </Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#b0b0b0"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loading ? ['#ccc', '#bbb'] : ['#ff9a1f', '#ff7b00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>Send Reset Link</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password? </Text>
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
    paddingTop: 56,
    paddingBottom: 36,
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
  headerContent: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 24,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconWrap: {
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.displayBold,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 6,
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
    padding: 28,
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
  inputGroup: {
    marginBottom: 24,
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
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#ff8c00',
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
    color: '#ff8c00',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  successBody: {
    flex: 1,
    marginTop: -16,
    paddingHorizontal: 24,
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  successIconWrap: {
    marginBottom: 14,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  emailSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  emailSentText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#c2410c',
  },
  successMessage: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  successHint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
  retryButton: {
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#888',
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
});
