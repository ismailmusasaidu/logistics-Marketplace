import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Package, User, LayoutDashboard, Bike, Users, DollarSign, Headphones, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const hubListener = {
  tabPress: (e: any) => {
    e.preventDefault();
    router.navigate('/hub');
  },
};

export default function TabLayout() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!profile) return;
    const needsApproval =
      (profile.role === 'vendor' || profile.role === 'rider') &&
      profile.vendor_status !== 'approved';

    if (needsApproval) {
      router.replace('/auth/vendor-pending');
    }
  }, [profile]);

  if (!profile) {
    return null;
  }

  if (profile.role === 'customer') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#f97316',
          tabBarInactiveTintColor: '#6b7280',
          tabBarLabelStyle: {
            fontSize: 11,
            letterSpacing: 0.3,
          },
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: Platform.OS === 'ios' ? 70 + insets.bottom : 65 + insets.bottom,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 4) : Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="back-to-hub"
          options={{
            title: 'Hub',
            tabBarIcon: ({ size }) => (
              <ArrowLeft size={size} color="#6b7280" />
            ),
          }}
          listeners={hubListener}
        />
        <Tabs.Screen
          name="customer-home"
          options={{
            title: 'Orders',
            tabBarIcon: ({ size, color }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="customer-request-service"
          options={{
            title: 'Request',
            tabBarIcon: ({ size, color }) => (
              <Headphones size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="customer-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="rider-home" options={{ href: null }} />
        <Tabs.Screen name="rider-profile" options={{ href: null }} />
        <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
        <Tabs.Screen name="admin-orders" options={{ href: null }} />
        <Tabs.Screen name="admin-riders" options={{ href: null }} />
        <Tabs.Screen name="admin-users" options={{ href: null }} />
        <Tabs.Screen name="admin-pricing" options={{ href: null }} />
        <Tabs.Screen name="admin-bank-accounts" options={{ href: null }} />
        <Tabs.Screen name="admin-zones" options={{ href: null }} />
        <Tabs.Screen name="admin-service-requests" options={{ href: null }} />
        <Tabs.Screen name="admin-reviews" options={{ href: null }} />
      </Tabs>
    );
  }

  if (profile.role === 'rider') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#6b7280',
          tabBarLabelStyle: {
            fontSize: 11,
            letterSpacing: 0.3,
          },
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: Platform.OS === 'ios' ? 70 + insets.bottom : 65 + insets.bottom,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 4) : Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="back-to-hub"
          options={{
            title: 'Hub',
            tabBarIcon: ({ size }) => (
              <ArrowLeft size={size} color="#6b7280" />
            ),
          }}
          listeners={hubListener}
        />
        <Tabs.Screen
          name="rider-home"
          options={{
            title: 'Deliveries',
            tabBarIcon: ({ size, color }) => (
              <Bike size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="rider-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="customer-home" options={{ href: null }} />
        <Tabs.Screen name="customer-profile" options={{ href: null }} />
        <Tabs.Screen name="customer-request-service" options={{ href: null }} />
        <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
        <Tabs.Screen name="admin-orders" options={{ href: null }} />
        <Tabs.Screen name="admin-riders" options={{ href: null }} />
        <Tabs.Screen name="admin-users" options={{ href: null }} />
        <Tabs.Screen name="admin-pricing" options={{ href: null }} />
        <Tabs.Screen name="admin-bank-accounts" options={{ href: null }} />
        <Tabs.Screen name="admin-zones" options={{ href: null }} />
        <Tabs.Screen name="admin-service-requests" options={{ href: null }} />
        <Tabs.Screen name="admin-reviews" options={{ href: null }} />
      </Tabs>
    );
  }

  if (profile.role === 'admin') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#f97316',
          tabBarInactiveTintColor: '#6b7280',
          tabBarLabelStyle: {
            fontSize: 10,
            marginTop: 2,
            letterSpacing: 0.3,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
            paddingHorizontal: 0,
          },
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: Platform.OS === 'ios' ? 75 + insets.bottom : 70 + insets.bottom,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 2, 8) : Math.max(insets.bottom + 4, 10),
            paddingTop: 6,
            paddingHorizontal: 4,
          },
        }}>
        <Tabs.Screen
          name="back-to-hub"
          options={{
            title: 'Hub',
            tabBarIcon: ({ size }) => (
              <ArrowLeft size={size} color="#6b7280" />
            ),
          }}
          listeners={hubListener}
        />
        <Tabs.Screen
          name="admin-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ size, color }) => (
              <LayoutDashboard size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ size, color }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-riders"
          options={{
            title: 'Riders',
            tabBarIcon: ({ size, color }) => (
              <Bike size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-users"
          options={{
            title: 'Users',
            tabBarIcon: ({ size, color }) => (
              <Users size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-pricing"
          options={{
            title: 'Pricing',
            tabBarIcon: ({ size, color }) => (
              <DollarSign size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="admin-bank-accounts" options={{ href: null }} />
        <Tabs.Screen name="admin-zones" options={{ href: null }} />
        <Tabs.Screen
          name="admin-service-requests"
          options={{
            title: 'Services',
            tabBarIcon: ({ size, color }) => (
              <Headphones size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="admin-reviews" options={{ href: null }} />
        <Tabs.Screen
          name="customer-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="customer-home" options={{ href: null }} />
        <Tabs.Screen name="customer-request-service" options={{ href: null }} />
        <Tabs.Screen name="rider-home" options={{ href: null }} />
        <Tabs.Screen name="rider-profile" options={{ href: null }} />
      </Tabs>
    );
  }

  return null;
}
