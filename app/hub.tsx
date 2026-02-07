import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, ShoppingBag, ArrowRight, LogOut } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

export default function Hub() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const handleLogistics = () => {
    if (!profile) return;
    if (profile.role === 'admin') {
      router.push('/(logistics)/admin-dashboard');
    } else if (profile.role === 'rider') {
      router.push('/(logistics)/rider-home');
    } else {
      router.push('/(logistics)/customer-home');
    }
  };

  const handleMarketplace = () => {
    router.push('/(marketplace)');
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </Text>
          <Text style={styles.subtitle}>Choose a service to continue</Text>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity style={styles.card} onPress={handleLogistics} activeOpacity={0.85}>
            <View style={styles.cardIconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: '#e0f2fe' }]}>
                <Truck size={32} color="#0284c7" />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Logistics</Text>
              <Text style={styles.cardDescription}>
                Send packages, track deliveries, and manage your logistics orders
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardAction}>Open Logistics</Text>
                <ArrowRight size={16} color="#0284c7" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleMarketplace} activeOpacity={0.85}>
            <View style={styles.cardIconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                <ShoppingBag size={32} color="#d97706" />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Marketplace</Text>
              <Text style={styles.cardDescription}>
                Browse products, shop from vendors, and manage your store
              </Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardAction, { color: '#d97706' }]}>Open Marketplace</Text>
                <ArrowRight size={16} color="#d97706" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <LogOut size={18} color="#64748b" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: '#64748b',
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 20,
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardIconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#64748b',
    lineHeight: 21,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  cardAction: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#0284c7',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#64748b',
  },
});
