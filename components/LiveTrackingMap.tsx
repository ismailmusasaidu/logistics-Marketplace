import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MapPin, Navigation, Package, Truck, RefreshCw } from 'lucide-react-native';
import { coreBackend } from '@/lib/coreBackend';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RiderLocation {
  lat: number | null;
  lng: number | null;
  updated_at: string | null;
}

interface LiveTrackingMapProps {
  orderId: string;
  orderStatus: string;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  riderId?: string | null;
}

interface StatusStep {
  key: string;
  label: string;
  icon: React.FC<any>;
}

const STEPS: StatusStep[] = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
];

const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];

function WebMapFrame({ pickupAddress, deliveryAddress }: { pickupAddress?: string | null; deliveryAddress?: string | null }) {
  const { colors } = useTheme();
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=3.0,6.2,3.6,6.7&layer=mapnik`;

  return (
    <View style={[styles.mapContainer, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={styles.mapPlaceholder}>
        <View style={[styles.mapOverlay, { backgroundColor: colors.surface }]}>
          <Navigation size={28} color={colors.primary} />
          <Text style={[styles.mapTitle, { color: colors.text }]}>Live Route</Text>
          {pickupAddress && (
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: '#059669' }]} />
              <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>{pickupAddress}</Text>
            </View>
          )}
          {deliveryAddress && (
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>{deliveryAddress}</Text>
            </View>
          )}
          <View style={[styles.routeLine, { backgroundColor: colors.border }]}>
            <View style={[styles.routeProgress, { backgroundColor: colors.primary }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function LiveTrackingMap({
  orderId,
  orderStatus,
  pickupAddress,
  deliveryAddress,
  riderId,
}: LiveTrackingMapProps) {
  const { colors } = useTheme();
  const [riderLocation, setRiderLocation] = useState<RiderLocation>({ lat: null, lng: null, updated_at: null });
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!riderId) return;
    fetchRiderLocation();

    const channel = coreBackend
      .channel(`rider_location_${riderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'riders', filter: `user_id=eq.${riderId}` },
        (payload) => {
          const r = payload.new as any;
          setRiderLocation({ lat: r.current_lat, lng: r.current_lng, updated_at: r.location_updated_at });
          setLastUpdate(new Date().toLocaleTimeString());
        }
      )
      .subscribe();

    return () => { coreBackend.removeChannel(channel); };
  }, [riderId]);

  useEffect(() => {
    if (orderStatus === 'out_for_delivery') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [orderStatus]);

  const fetchRiderLocation = async () => {
    if (!riderId) return;
    try {
      const { data } = await coreBackend
        .from('riders')
        .select('current_lat, current_lng, location_updated_at')
        .eq('user_id', riderId)
        .maybeSingle();
      if (data) {
        setRiderLocation({ lat: data.current_lat, lng: data.current_lng, updated_at: data.location_updated_at });
        if (data.location_updated_at) setLastUpdate(new Date(data.location_updated_at).toLocaleTimeString());
      }
    } catch {}
  };

  const currentStepIndex = STATUS_ORDER.indexOf(orderStatus);
  const isActive = orderStatus === 'out_for_delivery';
  const isDelivered = orderStatus === 'delivered';

  const progressSteps = STEPS.map((step) => {
    const stepIdx = STATUS_ORDER.indexOf(step.key);
    return { ...step, completed: currentStepIndex >= stepIdx, active: STATUS_ORDER.indexOf(step.key) === currentStepIndex };
  });

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statusHeader}>
        <View style={styles.statusLeft}>
          <Animated.View style={[styles.statusDot, { backgroundColor: isDelivered ? '#059669' : isActive ? colors.primary : colors.warning, transform: [{ scale: isActive ? pulseAnim : 1 }] }]} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {isDelivered ? 'Delivered' : isActive ? 'Rider on the way' : 'Tracking order'}
          </Text>
        </View>
        {lastUpdate && (
          <View style={styles.updateRow}>
            <RefreshCw size={11} color={colors.textMuted} />
            <Text style={[styles.updateText, { color: colors.textMuted }]}>{lastUpdate}</Text>
          </View>
        )}
      </View>

      <WebMapFrame pickupAddress={pickupAddress} deliveryAddress={deliveryAddress} />

      {riderId && riderLocation.lat && (
        <View style={[styles.riderCard, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.riderIconWrap, { backgroundColor: colors.primary + '20' }]}>
            <Truck size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.riderLabel, { color: colors.text }]}>Rider Location Updated</Text>
            <Text style={[styles.riderCoords, { color: colors.textMuted }]}>
              {riderLocation.lat?.toFixed(4)}°N, {riderLocation.lng?.toFixed(4)}°E
            </Text>
          </View>
        </View>
      )}

      <View style={styles.progressTrack}>
        {progressSteps.map((step, i) => {
          const Icon = step.icon;
          return (
            <React.Fragment key={step.key}>
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  {
                    backgroundColor: step.completed ? colors.primary : colors.border,
                    borderColor: step.active ? colors.primary : 'transparent',
                  }
                ]}>
                  <Icon size={12} color={step.completed ? '#fff' : colors.textMuted} />
                </View>
                <Text style={[styles.progressLabel, { color: step.completed ? colors.text : colors.textMuted }]}>{step.label}</Text>
              </View>
              {i < progressSteps.length - 1 && (
                <View style={[styles.progressLine, { backgroundColor: progressSteps[i + 1].completed ? colors.primary : colors.border }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontFamily: Fonts.spaceSemiBold },
  updateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  updateText: { fontSize: 11, fontFamily: Fonts.spaceRegular },
  mapContainer: { height: 160, margin: 0 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapOverlay: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  mapTitle: { fontSize: 14, fontFamily: Fonts.spaceSemiBold, marginBottom: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  addressText: { fontSize: 12, fontFamily: Fonts.spaceRegular, flex: 1 },
  routeLine: { width: '80%', height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  routeProgress: { width: '60%', height: 4, borderRadius: 2 },
  riderCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 12, padding: 10, borderRadius: 10 },
  riderIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  riderLabel: { fontSize: 13, fontFamily: Fonts.spaceMedium },
  riderCoords: { fontSize: 11, fontFamily: Fonts.spaceRegular },
  progressTrack: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 0 },
  progressStep: { alignItems: 'center', gap: 4, flex: 1 },
  progressDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  progressLine: { flex: 1, height: 2, marginTop: 13, marginHorizontal: -8 },
  progressLabel: { fontSize: 9, fontFamily: Fonts.spaceMedium, textAlign: 'center' },
});
