import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { coreBackend } from '@/lib/coreBackend';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function extractParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hash = url.substring(hashIndex + 1);
      hash.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      const queryEnd = hashIndex !== -1 ? hashIndex : url.length;
      const query = url.substring(queryIndex + 1, queryEnd);
      query.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
  } catch {}
  return params;
}

async function trySetSessionFromUrl(url: string): Promise<boolean> {
  const params = extractParamsFromUrl(url);
  const type = params['type'];
  const accessToken = params['access_token'];
  const refreshToken = params['refresh_token'];

  if (type === 'recovery' && accessToken && refreshToken) {
    const { error } = await coreBackend.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error;
  }
  return false;
}

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash || window.location.search;
        if (hash) {
          const fakeUrl = `https://placeholder${hash}`;
          const ok = await trySetSessionFromUrl(fakeUrl);
          if (mounted && ok) {
            setIsValidSession(true);
            setChecking(false);
            return;
          }
        }
      } else {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const ok = await trySetSessionFromUrl(initialUrl);
          if (mounted && ok) {
            setIsValidSession(true);
            setChecking(false);
            return;
          }
        }
      }

      const { data: { session } } = await coreBackend.auth.getSession();
      if (mounted && session) {
        setIsValidSession(true);
        setChecking(false);
        return;
      }

      if (mounted) {
        setChecking(false);
      }
    };

    initialize();

    const { data: { subscription } } = coreBackend.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    const linkingSub = Linking.addEventListener('url', async ({ url }) => {
      if (!mounted) return;
      const ok = await trySetSessionFromUrl(url);
      if (ok) {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    const timer = setTimeout(() => {
      if (mounted) setChecking(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkingSub.remove();
      clearTimeout(timer);
    };
  }, []);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
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
      const { error: updateError } = await coreBackend.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.replace('/auth/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <LinearGradient
        colors={['#ff8c00', '#ff6b00', '#ff4500']}
        style={styles.container}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.checkingText}>Verifying reset link...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!isValidSession) {
    return (
      <LinearGradient
        colors={['#ff8c00', '#ff6b00', '#ff4500']}
        style={styles.container}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Invalid or Expired Link</Text>
            <Text style={styles.errorMessage}>
              This password reset link is invalid or has expired. Please request a new one.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/auth/forgot-password')}
            >
              <Text style={styles.buttonText}>Request New Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (success) {
    return (
      <LinearGradient
        colors={['#ff8c00', '#ff6b00', '#ff4500']}
        style={styles.container}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <View style={styles.successContainer}>
            <View style={styles.iconContainer}>
              <CheckCircle size={64} color="#ffffff" strokeWidth={2} />
            </View>

            <Text style={styles.successTitle}>Password Reset!</Text>
            <Text style={styles.successMessage}>
              Your password has been successfully reset
            </Text>
            <Text style={styles.successSubtext}>
              Redirecting to sign in...
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#ff8c00', '#ff6b00', '#ff4500']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>
          Please enter your new password
        </Text>

        <View style={styles.form}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#ffa366"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            placeholderTextColor="#ffa366"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ff8c00" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  checkingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#ffe4cc',
    marginBottom: 36,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    fontSize: 16,
    color: '#cc5500',
    fontWeight: '600',
    borderWidth: 3,
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    outlineStyle: 'none',
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#ff8c00',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 28,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  errorMessage: {
    fontSize: 15,
    color: '#ffe4cc',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 24,
  },
  successContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 28,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  successMessage: {
    fontSize: 16,
    color: '#ffe4cc',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 24,
  },
  successSubtext: {
    fontSize: 14,
    color: '#ffe4cc',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
});
