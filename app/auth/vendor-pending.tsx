import { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Clock, CheckCircle, Mail, ShieldCheck, XCircle, RefreshCw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Fonts } from '@/constants/fonts';

export default function VendorPendingScreen() {
  const { signOut, profile, refreshProfile } = useAuth();
  const isRider = profile?.role === 'rider';
  const isRejected = profile?.vendor_status === 'rejected';
  const [checking, setChecking] = useState(false);

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

  useEffect(() => {
    if (profile?.vendor_status === 'approved') {
      router.replace('/hub');
    }
  }, [profile?.vendor_status]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshProfile();
    } finally {
      setChecking(false);
    }
  };

  const steps = isRider ? [
    { text: 'Our team will review your application' },
    { text: 'We may contact you for additional details' },
    { text: "You'll receive an email once approved" },
    { text: 'After approval, access your rider dashboard' },
  ] : [
    { text: 'Our team will review your business information' },
    { text: 'We may contact you for additional details' },
    { text: "You'll receive an email once approved" },
    { text: 'After approval, access your vendor dashboard' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isRejected ? ['#ef4444', '#dc2626', '#b91c1c'] : ['#ff9a1f', '#ff8c00', '#e67a00']}
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
              {isRejected ? (
                <XCircle size={40} color="#dc2626" strokeWidth={2} />
              ) : (
                <Clock size={40} color="#ff8c00" strokeWidth={2} />
              )}
            </View>
          </Animated.View>

          <Text style={styles.headerTitle}>
            {isRejected ? 'Application Rejected' : 'Under Review'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isRejected
              ? `Your ${isRider ? 'rider' : 'vendor'} application was not approved`
              : `Your ${isRider ? 'rider' : 'vendor'} application has been submitted`
            }
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
          {isRejected ? (
            <>
              <Text style={styles.cardTitle}>Rejection Details</Text>
              {profile?.rejection_reason ? (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionLabel}>Reason:</Text>
                  <Text style={styles.rejectionText}>{profile.rejection_reason}</Text>
                </View>
              ) : (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionText}>No specific reason was provided.</Text>
                </View>
              )}
              <Text style={styles.rejectionHint}>
                Please contact support if you believe this was a mistake, or sign out and register with updated information.
              </Text>
            </>
          ) : (
            <>
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
            </>
          )}

          {!isRejected && (
            <TouchableOpacity
              style={styles.checkStatusButton}
              onPress={handleCheckStatus}
              disabled={checking}
              activeOpacity={0.85}
            >
              {checking ? (
                <ActivityIndicator color="#ff8c00" size="small" />
              ) : (
                <>
                  <RefreshCw size={18} color="#ff8c00" strokeWidth={2} />
                  <Text style={styles.checkStatusText}>Check Status</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isRejected ? ['#ef4444', '#dc2626'] : ['#ff9a1f', '#ff7b00']}
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
  rejectionBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  rejectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#991b1b',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#dc2626',
    lineHeight: 20,
  },
  rejectionHint: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  checkStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#ff8c00',
    borderRadius: 14,
  },
  checkStatusText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
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
