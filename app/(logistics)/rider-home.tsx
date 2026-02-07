import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Order } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';

export default function RiderHome() {
  const { profile } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Rider Dashboard</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}>

        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <Bike size={32} color="#f97316" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
            {profile?.phone && (
              <Text style={styles.profilePhone}>{profile.phone}</Text>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Bike size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Package size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle size={28} color="#f97316" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.setupBanner}>
          <View style={styles.setupIconContainer}>
            <Clock size={48} color="#f97316" />
          </View>
          <Text style={styles.setupTitle}>Delivery System Being Set Up</Text>
          <Text style={styles.setupDescription}>
            The delivery assignment system is currently under development. Once it is ready, you will be able to receive and manage delivery orders directly from this dashboard.
          </Text>
          <View style={styles.setupDetails}>
            <Text style={styles.setupDetailsTitle}>What to expect:</Text>
            <Text style={styles.setupDetailsItem}>Real-time order assignments</Text>
            <Text style={styles.setupDetailsItem}>Delivery tracking and status updates</Text>
            <Text style={styles.setupDetailsItem}>Earnings and performance overview</Text>
            <Text style={styles.setupDetailsItem}>Route navigation assistance</Text>
          </View>
        </View>

        <View style={styles.emptyState}>
          <AlertCircle size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No deliveries assigned yet</Text>
          <Text style={styles.emptySubtext}>Delivery assignment system coming soon</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.semiBold,
  },
  setupBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  setupIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  setupDescription: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  setupDetails: {
    width: '100%',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
  },
  setupDetailsTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#c2410c',
    marginBottom: 12,
  },
  setupDetailsItem: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#9a3412',
    marginBottom: 8,
    lineHeight: 20,
    paddingLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    marginTop: 4,
  },
});
