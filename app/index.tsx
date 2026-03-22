import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function Index() {
  const { session, loading, profile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const navigate = async () => {
      const url = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : await Linking.getInitialURL();

      if (url) {
        const isResetPassword =
          url.includes('/auth/reset-password') ||
          url.includes('type=recovery') ||
          url.includes('reset-password');
        if (isResetPassword) {
          router.replace('/auth/reset-password');
          return;
        }

        const isEmailConfirm =
          url.includes('/auth/confirm') ||
          url.includes('type=email') ||
          url.includes('type=signup');
        if (isEmailConfirm) {
          router.replace('/auth/confirm');
          return;
        }
      }

      if (!session) {
        router.replace('/auth/login');
        return;
      }

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
    };

    navigate();
  }, [session, loading, profile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
