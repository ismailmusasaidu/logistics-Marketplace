import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { X, Navigation } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';

export interface MapPickerResult {
  address: string;
  lat: number;
  lng: number;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: MapPickerResult) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function MapPickerModal({
  visible,
  onClose,
  onSelect,
  initialLat = 9.0566,
  initialLng = 7.4969,
}: MapPickerModalProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'select') {
          onSelect({
            address: data.address,
            lat: data.lat,
            lng: data.lng,
          });
        }
      } catch (e) {
        console.error('Map picker message parse error:', e);
      }
    },
    [onSelect]
  );

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const mapUrl = `${supabaseUrl}/functions/v1/map-picker?lat=${initialLat}&lng=${initialLng}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pick your location</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <X size={22} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ff8c00" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: mapUrl }}
            onMessage={handleMessage}
            onLoad={() => setLoading(false)}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.hintBar}>
          <Navigation size={14} color="#9ca3af" />
          <Text style={styles.hintText}>Search for an address or drag the pin to your exact location</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.spaceSemiBold,
    color: '#1f2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontFamily: Fonts.spaceRegular,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.spaceRegular,
    flex: 1,
  },
});
