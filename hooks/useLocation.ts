import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { coreBackend } from '@/lib/coreBackend';

export type LocationState = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  permissionDenied: boolean;
  loading: boolean;
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (Platform.OS !== 'web') {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
        return parts.slice(0, 3).join(', ');
      }
    } else {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const json = await res.json();
      if (json?.display_name) {
        const parts = json.display_name.split(',').slice(0, 3);
        return parts.join(',').trim();
      }
    }
  } catch {
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function useLocation() {
  const [locationState, setLocationState] = useState<LocationState>({
    lat: null,
    lng: null,
    address: null,
    permissionDenied: false,
    loading: false,
  });

  const requestAndSaveLocation = useCallback(async (userId: string) => {
    setLocationState(prev => ({ ...prev, loading: true }));
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationState({ lat: null, lng: null, address: null, permissionDenied: true, loading: false });
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const address = await reverseGeocode(latitude, longitude);

      setLocationState({ lat: latitude, lng: longitude, address, permissionDenied: false, loading: false });

      await coreBackend
        .from('profiles')
        .update({
          location_lat: latitude,
          location_lng: longitude,
          location_address: address,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch {
      setLocationState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const loadSavedLocation = useCallback((profile: any) => {
    if (profile?.location_lat && profile?.location_lng) {
      setLocationState({
        lat: profile.location_lat,
        lng: profile.location_lng,
        address: profile.location_address ?? null,
        permissionDenied: false,
        loading: false,
      });
    }
  }, []);

  return { locationState, requestAndSaveLocation, loadSavedLocation };
}
