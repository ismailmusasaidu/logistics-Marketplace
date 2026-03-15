import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck, CircleX, Loader, Mail } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { coreBackend } from '@/lib/coreBackend';

type ConfirmState = 'loading' | 'success' | 'error' | 'expired';

export default function ConfirmPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ConfirmState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

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
        const desc = errorDescription?.replace(/\+/g, ' ') || 'The confirmation link is invalid or has expired.';
        if (desc.toLowerCase().includes('expired') || desc.toLowerCase().includes('invalid')) {
          setState('expired');
        } else {
          setState('error');
          setErrorMessage(desc);
        }
        animateIcon();
        return;
      }

      if (tokenHash && type === 'email') {
        const { error } = await coreBackend.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email',
        });

        if (error) {
          if (error.message.toLowerCase().includes('expired')) {
            setState('expired');
          } else {
            setState('error');
            setErrorMessage(error.message);
          }
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
          setState('error');
          setErrorMessage(error.message);
        } else {
          setState('success');
        }
        animateIcon();
        return;
      }

      setState('error');
      setErrorMessage('No confirmation token found in the link.');
      animateIcon();
    } catch (err: any) {
      setState('error');
      setErrorMessage('Something went wrong. Please try again.');
      animateIcon();
    }
  };

  const goToLogin = () => {
    router.replace('/auth/login');
  };

  const renderContent = () => {
    if (state === 'loading') {
      return (
        <>
          <Animated.View style={[styles.iconContainer, styles.iconLoading, { transform: [{ scale: iconScale }] }]}>
            <Loader size={40} color="#f97316" strokeWidth={2} />
          </Animated.View>
          <Text style={styles.title}>Verifying your email...</Text>
          <Text style={styles.subtitle}>Please wait while we confirm your email address.</Text>
        </>
      );
    }

    if (state === 'success') {
      return (
        <>
          <Animated.View style={[styles.iconContainer, styles.iconSuccess, { transform: [{ scale: iconScale }] }]}>
            <CircleCheck size={48} color="#16a34a" strokeWidth={2} />
          </Animated.View>
          <Text style={styles.title}>Email Confirmed!</Text>
          <Text style={styles.subtitle}>
            Your email address has been successfully verified. You can now sign in to your account.
          </Text>
          <TouchableOpacity style={styles.button} onPress={goToLogin} activeOpacity={0.85}>
            <LinearGradient
              colors={['#f97316', '#e85d04']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Sign In Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      );
    }

    if (state === 'expired') {
      return (
        <>
          <Animated.View style={[styles.iconContainer, styles.iconWarning, { transform: [{ scale: iconScale }] }]}>
            <Mail size={48} color="#d97706" strokeWidth={2} />
          </Animated.View>
          <Text style={styles.title}>Link Expired</Text>
          <Text style={styles.subtitle}>
            This confirmation link has expired. Please sign in and request a new confirmation email.
          </Text>
          <TouchableOpacity style={styles.button} onPress={goToLogin} activeOpacity={0.85}>
            <LinearGradient
              colors={['#f97316', '#e85d04']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Go to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <Animated.View style={[styles.iconContainer, styles.iconError, { transform: [{ scale: iconScale }] }]}>
          <CircleX size={48} color="#dc2626" strokeWidth={2} />
        </Animated.View>
        <Text style={styles.title}>Confirmation Failed</Text>
        <Text style={styles.subtitle}>
          {errorMessage || 'We could not verify your email. The link may be invalid or already used.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={goToLogin} activeOpacity={0.85}>
          <LinearGradient
            colors={['#f97316', '#e85d04']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Go to Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </>
    );
  };

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
          {renderContent()}
        </Animated.View>

        <Text style={styles.footerText}>
          Need help?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/help-center')}>
            Contact Support
          </Text>
        </Text>
      </View>
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
  brandName: {
    fontFamily: 'Playfair-Bold',
    fontSize: 32,
    color: '#ffffff',
    letterSpacing: 1,
  },
  brandTagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 36,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconSuccess: {
    backgroundColor: '#f0fdf4',
  },
  iconError: {
    backgroundColor: '#fef2f2',
  },
  iconWarning: {
    backgroundColor: '#fffbeb',
  },
  iconLoading: {
    backgroundColor: '#fff7ed',
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
    marginBottom: 32,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
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
