import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function ResetPasswordScreen() {
  useEffect(() => {
    router.replace('/auth/forgot-password');
  }, []);

  return (
    <LinearGradient colors={['#ff8c00', '#ff6b00', '#ff4500']} style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
