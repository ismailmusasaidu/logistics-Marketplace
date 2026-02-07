import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      const redirect = setTimeout(() => {
        if (session && profile) {
          const needsApproval =
            (profile.role === 'vendor' || profile.role === 'rider') &&
            profile.vendor_status !== 'approved';

          if (needsApproval) {
            router.replace('/auth/vendor-pending');
          } else {
            router.replace('/hub');
          }
        } else {
          router.replace('/auth/login');
        }
      }, 100);
      return () => clearTimeout(redirect);
    }
  }, [session, loading, profile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
