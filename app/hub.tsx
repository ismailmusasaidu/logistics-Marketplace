import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, ShoppingBag, ArrowRight, LogOut, Shield, ChevronRight } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function Hub() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  useEffect(() => {
    if (!profile) return;
    const needsApproval =
      (profile.role === 'vendor' || profile.role === 'rider') &&
      profile.vendor_status !== 'approved';

    if (needsApproval) {
      router.replace('/auth/vendor-pending');
    }
  }, [profile]);

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

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <LinearGradient
      colors={['#0f0f0f', '#1a1a1a', '#111111']}
      style={styles.bgGradient}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContent}>

          <View style={styles.header}>
            <View style={styles.roleBadge}>
              <Shield size={11} color="#f97316" />
              <Text style={styles.roleBadgeText}>{getRoleLabel()}</Text>
            </View>

            <Text style={styles.greeting}>
              {firstName ? `Hey, ${firstName}` : 'Welcome back'}
            </Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>

          <View style={[styles.cardsContainer, isSingleOption && styles.cardsContainerSingle]}>
            {showLogistics && (
              <TouchableOpacity
                style={[styles.card, isSingleOption && styles.cardSingle]}
                onPress={handleLogistics}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#0f2744', '#0c3461', '#0a4080']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1.2 }}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardDecorCircle1} />
                  <View style={styles.cardDecorCircle2} />

                  <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                      <LinearGradient
                        colors={['#2563eb', '#1d4ed8']}
                        style={styles.iconGradient}
                      >
                        <Truck size={26} color="#ffffff" strokeWidth={1.8} />
                      </LinearGradient>
                    </View>
                    <View style={styles.cardChevronWrap}>
                      <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{getLogisticsTitle()}</Text>
                    <Text style={styles.cardDescription}>{getLogisticsDescription()}</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.cardCta}>
                      <Text style={styles.cardCtaText}>
                        {profile?.role === 'admin' ? 'Open Management' : profile?.role === 'rider' ? 'Open Dashboard' : 'Open Logistics'}
                      </Text>
                      <ArrowRight size={14} color="#60a5fa" strokeWidth={2.5} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {showMarketplace && (
              <TouchableOpacity
                style={[styles.card, isSingleOption && styles.cardSingle]}
                onPress={handleMarketplace}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#1f1200', '#2d1800', '#3d2000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1.2 }}
                  style={styles.cardGradient}
                >
                  <View style={[styles.cardDecorCircle1, { backgroundColor: 'rgba(249,115,22,0.08)' }]} />
                  <View style={[styles.cardDecorCircle2, { backgroundColor: 'rgba(249,115,22,0.05)' }]} />

                  <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                      <LinearGradient
                        colors={['#f97316', '#ea580c']}
                        style={styles.iconGradient}
                      >
                        <ShoppingBag size={26} color="#ffffff" strokeWidth={1.8} />
                      </LinearGradient>
                    </View>
                    <View style={styles.cardChevronWrap}>
                      <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{getMarketplaceTitle()}</Text>
                    <Text style={styles.cardDescription}>{getMarketplaceDescription()}</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.cardCta}>
                      <Text style={[styles.cardCtaText, { color: '#fb923c' }]}>
                        {profile?.role === 'admin' ? 'Open Management' : profile?.role === 'vendor' ? 'Open Dashboard' : 'Open Marketplace'}
                      </Text>
                      <ArrowRight size={14} color="#fb923c" strokeWidth={2.5} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
            <LogOut size={16} color="#52525b" strokeWidth={2} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bgGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#f97316',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greeting: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: '#f4f4f5',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  cardsContainerSingle: {
    alignItems: 'center',
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardSingle: {
    maxWidth: 480,
    width: '100%',
  },
  cardGradient: {
    padding: 24,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  cardDecorCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(37,99,235,0.08)',
    top: -60,
    right: -40,
  },
  cardDecorCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(37,99,235,0.05)',
    bottom: 10,
    left: -20,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    gap: 8,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#f4f4f5',
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 16,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardCtaText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#60a5fa',
    letterSpacing: 0.1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  signOutText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#52525b',
  },
});
