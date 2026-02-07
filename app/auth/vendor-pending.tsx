import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Clock, CheckCircle, Mail, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Fonts } from '@/constants/fonts';

export default function VendorPendingScreen() {
  const { signOut } = useAuth();

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

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  const steps = [
    { icon: CheckCircle, text: 'Our team will review your business information' },
    { icon: Mail, text: 'We may contact you for additional details' },
    { icon: Mail, text: "You'll receive an email once approved" },
    { icon: ShieldCheck, text: 'After approval, access your vendor dashboard' },
  ];

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
            styles.headerContent,
            { opacity: fadeAnim },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <View style={styles.iconCircle}>
              <Clock size={40} color="#ff8c00" strokeWidth={2} />
            </View>
          </Animated.View>

          <Text style={styles.headerTitle}>Under Review</Text>
          <Text style={styles.headerSubtitle}>
            Your vendor application has been submitted
          </Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View
        style={[
          styles.body,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happens next?</Text>

          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}

          <View style={styles.timeBadge}>
            <Clock size={16} color="#92400e" strokeWidth={2} />
            <Text style={styles.timeBadgeText}>Usually takes 24-48 hours</Text>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#ff9a1f', '#ff7b00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signOutGradient}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5f0',
  },
  headerGradient: {
    paddingTop: 72,
    paddingBottom: 44,
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
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 30,
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
  body: {
    flex: 1,
    marginTop: -20,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#1a1a1a',
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#ff8c00',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#555',
    lineHeight: 20,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignSelf: 'center',
  },
  timeBadgeText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#92400e',
  },
  signOutButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  signOutGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    letterSpacing: 0.5,
  },
});
