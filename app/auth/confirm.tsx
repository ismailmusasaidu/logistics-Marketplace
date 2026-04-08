import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck, CircleX, Mail, ShieldCheck } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { coreBackend } from '@/lib/coreBackend';
import { supabase } from '@/lib/supabase';

type ConfirmState = 'loading' | 'otp_entry' | 'success' | 'error';

export default function ConfirmPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ConfirmState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    handleEmailConfirmation();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const animateIcon = () => {
    setTimeout(() => {
      Animated.spring(iconScale, {
        toValue: 1,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    }, 200);
  };

  const parseTokensFromUrl = (url: string) => {
    const hashStr = url.includes('#') ? url.split('#')[1] : '';
    const queryStr = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
    const hash = new URLSearchParams(hashStr);
    const query = new URLSearchParams(queryStr);
    const get = (key: string) => hash.get(key) || query.get(key) || null;
    return {
      accessToken: get('access_token'),
      refreshToken: get('refresh_token'),
      tokenHash: get('token_hash'),
      type: get('type'),
      errorParam: get('error'),
      errorDescription: get('error_description'),
    };
  };

  const handleEmailConfirmation = async () => {
    try {
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let tokenHash: string | null = null;
      let type: string | null = null;
      let errorParam: string | null = null;
      let errorDescription: string | null = null;

      if (Platform.OS !== 'web') {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const parsed = parseTokensFromUrl(initialUrl);
          accessToken = parsed.accessToken;
          refreshToken = parsed.refreshToken;
          tokenHash = parsed.tokenHash;
          type = parsed.type;
          errorParam = parsed.errorParam;
          errorDescription = parsed.errorDescription;
        }
      } else {
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const searchParams = new URLSearchParams(window.location.search);
        const get = (key: string) => hashParams.get(key) || searchParams.get(key) || null;
        accessToken = get('access_token');
        refreshToken = get('refresh_token');
        tokenHash = get('token_hash');
        type = get('type');
        errorParam = get('error');
        errorDescription = get('error_description');
      }

      if (errorParam) {
        setState('otp_entry');
        animateIcon();
        return;
      }

      if (tokenHash && type === 'email') {
        const { error } = await coreBackend.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email',
        });

        if (error) {
          setState('otp_entry');
        } else {
          setState('success');
        }
        animateIcon();
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await coreBackend.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setState('otp_entry');
        } else {
          setState('success');
        }
        animateIcon();
        return;
      }

      setState('otp_entry');
      animateIcon();
    } catch {
      setState('otp_entry');
      animateIcon();
    }
  };

  const handleVerifyOtp = async () => {
    if (!email) { setOtpError('Please enter your email address'); return; }
    if (!otp || otp.length < 6) { setOtpError('Please enter the verification code'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      });
      if (verifyError) throw verifyError;
      setState('success');
      animateIcon();
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

  const handleResend = async () => {
    if (!email) { setOtpError('Please enter your email address first'); return; }
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

  if (state === 'loading') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#2d1a00', '#3d2200']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 24 }]}
        >
          <Text style={styles.brandName}>Danhausa</Text>
          <Text style={styles.brandTagline}>Email Verification</Text>
        </LinearGradient>
        <View style={styles.body}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Verifying your email...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (state === 'success') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#2d1a00', '#3d2200']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 24 }]}
        >
          <Text style={styles.brandName}>Danhausa</Text>
          <Text style={styles.brandTagline}>Email Verification</Text>
        </LinearGradient>
        <View style={styles.body}>
          <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
            <Animated.View style={[styles.iconContainer, styles.iconSuccess, { transform: [{ scale: iconScale }] }]}>
              <CircleCheck size={48} color="#16a34a" strokeWidth={2} />
            </Animated.View>
            <Text style={styles.title}>Email Confirmed!</Text>
            <Text style={styles.subtitle}>
              Your email address has been successfully verified. You can now sign in to your account.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/auth/login')} activeOpacity={0.85}>
              <LinearGradient colors={['#f97316', '#e85d04']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Sign In Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#2d1a00', '#3d2200']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 24 }]}
        >
          <Text style={styles.brandName}>Danhausa</Text>
          <Text style={styles.brandTagline}>Email Verification</Text>
        </LinearGradient>
        <View style={styles.body}>
          <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
            <Animated.View style={[styles.iconContainer, styles.iconError, { transform: [{ scale: iconScale }] }]}>
              <CircleX size={48} color="#dc2626" strokeWidth={2} />
            </Animated.View>
            <Text style={styles.title}>Confirmation Failed</Text>
            <Text style={styles.subtitle}>{errorMessage || 'We could not verify your email. Please use the code below.'}</Text>
            <TouchableOpacity style={styles.button} onPress={() => setState('otp_entry')} activeOpacity={0.85}>
              <LinearGradient colors={['#f97316', '#e85d04']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Enter Code Instead</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d1a00', '#3d2200']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.headerIconCircle}>
          <ShieldCheck size={28} color="#f97316" strokeWidth={2} />
        </View>
        <Text style={styles.brandName}>Verify Your Email</Text>
        <Text style={styles.brandTagline}>Enter the code we sent to your email</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
            {otpError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{otpError}</Text>
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
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="00000000"
                placeholderTextColor="#b0b0b0"
                value={otp}
                onChangeText={t => setOtp(t.replace(/[^0-9]/g, '').slice(0, 8))}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (otpLoading || otp.length < 6 || !email) && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={otpLoading || otp.length < 6 || !email}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={(otpLoading || otp.length < 6 || !email) ? ['#ccc', '#bbb'] : ['#f97316', '#e85d04']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {otpLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify & Activate</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResend}
              disabled={resendCooldown > 0 || otpLoading}
            >
              <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive a code? Resend"}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => router.replace('/auth/login')} style={styles.skipButton}>
              <Text style={styles.skipText}>Go to Sign In</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footerText}>
            Need help?{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/help-center')}>
              Contact Support
            </Text>
          </Text>
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
  header: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
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
    fontFamily: 'Playfair-Bold',
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: 1,
    textAlign: 'center',
  },
  brandTagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  scrollBody: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginTop: -16,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  iconSuccess: {
    backgroundColor: '#f0fdf4',
  },
  iconError: {
    backgroundColor: '#fef2f2',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
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
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#444',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#eee',
    outlineStyle: 'none' as any,
  },
  otpInput: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 20,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  resendButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  resendText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  resendTextDisabled: {
    color: '#bbb',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
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
    fontFamily: 'Inter-Regular',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footerLink: {
    color: '#f97316',
    fontFamily: 'Inter-SemiBold',
  },
});
