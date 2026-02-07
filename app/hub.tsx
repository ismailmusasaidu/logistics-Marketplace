import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, ShoppingBag, ArrowRight, LogOut, Shield } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';

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

  const showLogistics = profile?.role === 'customer' || profile?.role === 'admin' || profile?.role === 'rider';
  const showMarketplace = profile?.role === 'customer' || profile?.role === 'admin' || profile?.role === 'vendor';
  const isSingleOption = (showLogistics ? 1 : 0) + (showMarketplace ? 1 : 0) === 1;

  const getRoleLabel = () => {
    switch (profile?.role) {
      case 'admin': return 'Administrator';
      case 'vendor': return 'Vendor';
      case 'rider': return 'Rider';
      default: return 'Customer';
    }
  };

  const getSubtitle = () => {
    if (profile?.role === 'vendor') return 'Manage your store and orders';
    if (profile?.role === 'rider') return 'View and manage your deliveries';
    if (profile?.role === 'admin') return 'Choose a module to manage';
    return 'Choose a service to continue';
  };

  const getLogisticsDescription = () => {
    if (profile?.role === 'admin') return 'Manage riders, orders, zones, pricing, and delivery operations';
    if (profile?.role === 'rider') return 'View assigned deliveries, update statuses, and manage your profile';
    return 'Send packages, track deliveries, and manage your logistics orders';
  };

  const getMarketplaceDescription = () => {
    if (profile?.role === 'admin') return 'Manage vendors, products, categories, orders, and marketplace settings';
    if (profile?.role === 'vendor') return 'Manage your store, products, orders, and track your sales';
    return 'Browse products, shop from vendors, and manage your orders';
  };

  const getLogisticsTitle = () => {
    if (profile?.role === 'admin') return 'Logistics Management';
    if (profile?.role === 'rider') return 'Rider Dashboard';
    return 'Logistics';
  };

  const getMarketplaceTitle = () => {
    if (profile?.role === 'admin') return 'Marketplace Management';
    if (profile?.role === 'vendor') return 'Vendor Dashboard';
    return 'Marketplace';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.roleBadge}>
            <Shield size={12} color="#ff8c00" />
            <Text style={styles.roleBadgeText}>{getRoleLabel()}</Text>
          </View>
          <Text style={styles.greeting}>
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
        </View>

        <View style={styles.cardsContainer}>
          {showLogistics && (
            <TouchableOpacity
              style={[styles.card, isSingleOption && styles.cardSingle]}
              onPress={handleLogistics}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#f0f9ff', '#e0f2fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#0284c7' }]}>
                    <Truck size={28} color="#ffffff" />
                  </View>
                  <ArrowRight size={20} color="#0284c7" style={styles.arrowIcon} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{getLogisticsTitle()}</Text>
                  <Text style={styles.cardDescription}>{getLogisticsDescription()}</Text>
                </View>
                <View style={[styles.cardActionBar, { backgroundColor: '#0284c7' }]}>
                  <Text style={styles.cardActionText}>
                    {profile?.role === 'admin' ? 'Open Management' : profile?.role === 'rider' ? 'Open Dashboard' : 'Open Logistics'}
                  </Text>
                  <ArrowRight size={14} color="#ffffff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {showMarketplace && (
            <TouchableOpacity
              style={[styles.card, isSingleOption && styles.cardSingle]}
              onPress={handleMarketplace}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#fffbeb', '#fef3c7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#d97706' }]}>
                    <ShoppingBag size={28} color="#ffffff" />
                  </View>
                  <ArrowRight size={20} color="#d97706" style={styles.arrowIcon} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{getMarketplaceTitle()}</Text>
                  <Text style={styles.cardDescription}>{getMarketplaceDescription()}</Text>
                </View>
                <View style={[styles.cardActionBar, { backgroundColor: '#d97706' }]}>
                  <Text style={styles.cardActionText}>
                    {profile?.role === 'admin' ? 'Open Management' : profile?.role === 'vendor' ? 'Open Dashboard' : 'Open Marketplace'}
                  </Text>
                  <ArrowRight size={14} color="#ffffff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
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
    marginBottom: 32,
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  roleBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#c2410c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  cardSingle: {
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  cardGradient: {
    padding: 24,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    opacity: 0.4,
  },
  cardContent: {
    gap: 8,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#475569',
    lineHeight: 21,
  },
  cardActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cardActionText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
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
