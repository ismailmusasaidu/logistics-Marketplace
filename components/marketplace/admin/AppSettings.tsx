import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Truck, Settings2 } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';

interface Props {
  onBack: () => void;
}

export default function AppSettings({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [logisticsEnabled, setLogisticsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('logistics_enabled')
        .eq('id', 1)
        .single();
      if (error) throw error;
      setLogisticsEnabled(data.logistics_enabled);
    } catch (err) {
      console.error('Failed to fetch app settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    setSaving(true);
    const previous = logisticsEnabled;
    setLogisticsEnabled(value);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ logistics_enabled: value, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update app settings:', err);
      setLogisticsEnabled(previous);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerBadge}>
          <Settings2 size={14} color="#ff8c00" />
          <Text style={styles.headerBadgeText}>App Settings</Text>
        </View>
        <Text style={styles.title}>Platform Modules</Text>
        <Text style={styles.subtitle}>Enable or disable platform sections</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>MODULES</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#eff6ff' }]}>
              <Truck size={22} color="#2563eb" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Logistics Module</Text>
              <Text style={styles.rowDesc}>
                {logisticsEnabled
                  ? 'Visible in Hub for all users'
                  : 'Hidden from Hub for all users'}
              </Text>
            </View>
            <View style={styles.switchWrap}>
              {saving ? (
                <ActivityIndicator size="small" color="#ff8c00" />
              ) : (
                <Switch
                  value={logisticsEnabled}
                  onValueChange={handleToggle}
                  trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                  thumbColor={logisticsEnabled ? '#2563eb' : '#9ca3af'}
                />
              )}
            </View>
          </View>

          <View style={styles.hint}>
            <Text style={styles.hintText}>
              When disabled, the Logistics card is hidden on the Hub screen for customers, riders, and admins.
              You can re-enable it here at any time.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
  },
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  headerBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 12,
    color: '#ff8c00',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 4,
  },
  content: {
    padding: 20,
  },
  sectionLabel: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 11,
    color: '#9ca3af',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#1a1d23',
    marginBottom: 2,
  },
  rowDesc: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#8b909a',
  },
  switchWrap: {
    width: 52,
    alignItems: 'center',
  },
  hint: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f1f3',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  hintText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
});
