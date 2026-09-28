import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MapPin, Search, X, Check, Navigation } from 'lucide-react-native';
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
  supabaseUrl?: string;
}

const HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #e5e7eb; }
    #search-bar {
      position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000;
      background: #fff; border-radius: 12px; padding: 8px 12px;
      display: flex; align-items: center; gap: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    }
    #search-bar svg { flex-shrink: 0; color: #9ca3af; }
    #search-input {
      flex: 1; border: none; outline: none; font-size: 15px; padding: 6px 0;
      background: transparent; color: #1f2937;
    }
    #search-input::placeholder { color: #9ca3af; }
    #search-results {
      position: absolute; top: 56px; left: 12px; right: 12px; z-index: 999;
      background: #fff; border-radius: 12px; overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      display: none; max-height: 260px; overflow-y: auto;
    }
    .search-item {
      padding: 12px 14px; border-bottom: 1px solid #f3f4f6;
      cursor: pointer; font-size: 14px; color: #1f2937;
      display: flex; align-items: flex-start; gap: 8px;
    }
    .search-item:last-child { border-bottom: none; }
    .search-item:hover, .search-item:active { background: #f9fafb; }
    .search-item-icon { color: #ff8c00; flex-shrink: 0; margin-top: 1px; }
    .search-item-text { flex: 1; }
    .search-item-main { font-weight: 500; font-size: 14px; }
    .search-item-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
    #selected-address {
      position: absolute; bottom: 84px; left: 12px; right: 12px; z-index: 1000;
      background: #fff; border-radius: 12px; padding: 12px 14px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      display: none;
    }
    #selected-address-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    #selected-address-text { font-size: 14px; color: #1f2937; line-height: 1.4; }
    #confirm-btn {
      position: absolute; bottom: 16px; left: 12px; right: 12px; z-index: 1000;
      background: #ff8c00; color: #fff; border: none; border-radius: 12px;
      padding: 14px; font-size: 16px; font-weight: 600;
      display: none; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 16px rgba(255,140,0,0.4);
    }
    #confirm-btn:active { opacity: 0.85; }
    #loading-overlay {
      position: absolute; inset: 0; z-index: 2000; background: rgba(255,255,255,0.8);
      display: flex; align-items: center; justify-content: center;
    }
    .spinner {
      width: 36px; height: 36px; border: 3px solid #e5e7eb;
      border-top-color: #ff8c00; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .leaflet-control-attribution { font-size: 9px !important; }
    .leaflet-control-zoom { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; }
    .leaflet-control-zoom a { border-radius: 8px !important; color: #1f2937 !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loading-overlay"><div class="spinner"></div></div>

  <div id="search-bar">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input id="search-input" type="text" placeholder="Search for an address or area..." autocomplete="off" />
  </div>

  <div id="search-results"></div>

  <div id="selected-address">
    <div id="selected-address-label">Selected Location</div>
    <div id="selected-address-text"></div>
  </div>

  <button id="confirm-btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    Confirm Location
  </button>

  <script>
    var initialLat = __INITIAL_LAT__;
    var initialLng = __INITIAL_LNG__;
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([initialLat, initialLng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    var marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    var currentLat = initialLat;
    var currentLng = initialLng;
    var currentAddress = '';

    function sendMessage(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }

    function reverseGeocode(lat, lng) {
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json&zoom=18&addressdetails=1', {
        headers: { 'User-Agent': 'DanHausa-Delivery-App/1.0' }
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && data.display_name) {
            currentAddress = data.display_name;
            updateAddressDisplay(data.display_name);
          } else {
            currentAddress = lat.toFixed(5) + ', ' + lng.toFixed(5);
            updateAddressDisplay(currentAddress);
          }
        })
        .catch(function() {
          currentAddress = lat.toFixed(5) + ', ' + lng.toFixed(5);
          updateAddressDisplay(currentAddress);
        });
    }

    function updateAddressDisplay(addr) {
      document.getElementById('selected-address-text').textContent = addr;
      document.getElementById('selected-address').style.display = 'block';
      document.getElementById('confirm-btn').style.display = 'flex';
    }

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      currentLat = pos.lat;
      currentLng = pos.lng;
      reverseGeocode(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      currentLat = e.latlng.lat;
      currentLng = e.latlng.lng;
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    // Initial reverse geocode
    reverseGeocode(initialLat, initialLng);

    // Hide loading overlay once tiles start loading
    map.whenReady(function() {
      setTimeout(function() {
        document.getElementById('loading-overlay').style.display = 'none';
      }, 600);
    });

    // Search functionality using Nominatim
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    var searchTimer = null;

    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimer);
      var query = searchInput.value.trim();
      if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
      }
      searchTimer = setTimeout(function() {
        fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=5&countrycodes=ng&addressdetails=1')
          .then(function(r) { return r.json(); })
          .then(function(results) {
            if (!Array.isArray(results) || results.length === 0) {
              searchResults.innerHTML = '<div class="search-item"><div class="search-item-text"><div class="search-item-main">No results found</div><div class="search-item-sub">Try a different search term</div></div></div>';
              searchResults.style.display = 'block';
              return;
            }
            searchResults.innerHTML = results.map(function(r) {
              var parts = (r.display_name || '').split(',');
              var main = parts[0] || r.display_name;
              var sub = parts.slice(1, 4).join(',').trim();
              return '<div class="search-item" data-lat="' + r.lat + '" data-lon="' + r.lon + '" data-name="' + encodeURIComponent(r.display_name) + '">'
                + '<div class="search-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>'
                + '<div class="search-item-text"><div class="search-item-main">' + main + '</div><div class="search-item-sub">' + sub + '</div></div>'
                + '</div>';
            }).join('');
            searchResults.style.display = 'block';

            var items = searchResults.querySelectorAll('.search-item');
            items.forEach(function(item) {
              item.addEventListener('click', function() {
                var lat = parseFloat(item.getAttribute('data-lat'));
                var lng = parseFloat(item.getAttribute('data-lon'));
                var name = decodeURIComponent(item.getAttribute('data-name'));
                currentLat = lat;
                currentLng = lng;
                currentAddress = name;
                marker.setLatLng([lat, lng]);
                map.setView([lat, lng], 16);
                searchInput.value = name.split(',')[0];
                searchResults.style.display = 'none';
                updateAddressDisplay(name);
              });
            });
          })
          .catch(function() {
            searchResults.innerHTML = '<div class="search-item"><div class="search-item-text"><div class="search-item-main">Search failed</div><div class="search-item-sub">Please check your connection</div></div></div>';
            searchResults.style.display = 'block';
          });
      }, 500);
    });

    searchInput.addEventListener('focus', function() {
      if (searchResults.children.length > 0) searchResults.style.display = 'block';
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#search-bar') && !e.target.closest('#search-results')) {
        searchResults.style.display = 'none';
      }
    });

    document.getElementById('confirm-btn').addEventListener('click', function() {
      sendMessage({
        type: 'select',
        address: currentAddress,
        lat: currentLat,
        lng: currentLng
      });
    });
  </script>
</body>
</html>
`;

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

  const html = HTML.replace('__INITIAL_LAT__', String(initialLat)).replace('__INITIAL_LNG__', String(initialLng));

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
            source={{ html }}
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
