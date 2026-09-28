import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");
    const lat = latParam ? parseFloat(latParam) : 9.0566;
    const lng = lngParam ? parseFloat(lngParam) : 7.4969;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    html, body, #map { height: 100%; width: 100%; }
    body { background: #e5e7eb; }
    #search-bar {
      position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000;
      background: #fff; border-radius: 12px; padding: 8px 12px;
      display: flex; align-items: center; gap: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    }
    #search-icon { flex-shrink: 0; color: #9ca3af; width: 20px; height: 20px; }
    #search-input {
      flex: 1; border: none; outline: none; font-size: 15px; padding: 6px 0;
      background: transparent; color: #1f2937;
    }
    #search-input::placeholder { color: #9ca3af; }
    #selected-address {
      position: absolute; bottom: 84px; left: 12px; right: 12px; z-index: 1000;
      background: #fff; border-radius: 12px; padding: 12px 14px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      display: none;
    }
    #selected-address-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 600; }
    #selected-address-text { font-size: 14px; color: #1f2937; line-height: 1.4; }
    #confirm-btn {
      position: absolute; bottom: 16px; left: 12px; right: 12px; z-index: 1000;
      background: #ff8c00; color: #fff; border: none; border-radius: 12px;
      padding: 14px; font-size: 16px; font-weight: 600;
      display: none; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 16px rgba(255,140,0,0.4); cursor: pointer;
    }
    #confirm-btn:active { opacity: 0.85; }
    #loading-overlay {
      position: absolute; inset: 0; z-index: 2000; background: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px;
    }
    .spinner {
      width: 36px; height: 36px; border: 3px solid #e5e7eb;
      border-top-color: #ff8c00; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .loading-text { font-size: 14px; color: #6b7280; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pac-container {
      border-radius: 0 0 12px 12px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
      border: none !important;
      margin-top: -4px;
      z-index: 1001 !important;
    }
    .pac-item {
      padding: 10px 14px !important;
      font-size: 14px !important;
      color: #1f2937 !important;
      font-family: 'Inter', sans-serif !important;
      cursor: pointer;
    }
    .pac-item:hover, .pac-item-selected { background: #f9fafb !important; }
    .pac-icon { display: none !important; }
    .pac-item-query { font-weight: 500; }
    .gm-style-cc, .gmnoprint a, .gmnoprint span { display: none !important; }
    .gm-style-mtc { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loading-overlay"><div class="spinner"></div><div class="loading-text">Loading map...</div></div>

  <div id="search-bar">
    <svg id="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input id="search-input" type="text" placeholder="Search for an address or area..." autocomplete="off" />
  </div>

  <div id="selected-address">
    <div id="selected-address-label">Selected Location</div>
    <div id="selected-address-text"></div>
  </div>

  <button id="confirm-btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    Confirm Location
  </button>

  <script>
    var INITIAL_LAT = ${lat};
    var INITIAL_LNG = ${lng};
    var currentLat = INITIAL_LAT;
    var currentLng = INITIAL_LNG;
    var currentAddress = '';
    var map, marker, geocoder, autocomplete;

    function sendMessage(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }

    function updateAddressDisplay(addr) {
      document.getElementById('selected-address-text').textContent = addr;
      document.getElementById('selected-address').style.display = 'block';
      document.getElementById('confirm-btn').style.display = 'flex';
    }

    function reverseGeocode(lat, lng) {
      if (!geocoder) return;
      geocoder.geocode({ location: { lat: lat, lng: lng } }, function(results, status) {
        if (status === 'OK' && results && results.length > 0) {
          currentAddress = results[0].formatted_address;
          updateAddressDisplay(currentAddress);
        } else {
          currentAddress = lat.toFixed(5) + ', ' + lng.toFixed(5);
          updateAddressDisplay(currentAddress);
        }
      });
    }

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: INITIAL_LAT, lng: INITIAL_LNG },
        zoom: 14,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'simplified' }] }
        ]
      });

      geocoder = new google.maps.Geocoder();

      marker = new google.maps.Marker({
        position: { lat: INITIAL_LAT, lng: INITIAL_LNG },
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP
      });

      marker.addListener('dragend', function(e) {
        currentLat = e.latLng.lat();
        currentLng = e.latLng.lng();
        reverseGeocode(currentLat, currentLng);
      });

      map.addListener('click', function(e) {
        currentLat = e.latLng.lat();
        currentLng = e.latLng.lng();
        marker.setPosition(e.latLng);
        reverseGeocode(currentLat, currentLng);
      });

      var input = document.getElementById('search-input');
      autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'ng' }
      });

      autocomplete.addListener('place_changed', function() {
        var place = autocomplete.getPlace();
        if (!place || !place.geometry) return;
        currentLat = place.geometry.location.lat();
        currentLng = place.geometry.location.lng();
        currentAddress = place.formatted_address || place.name;
        marker.setPosition(place.geometry.location);
        map.setCenter(place.geometry.location);
        map.setZoom(16);
        updateAddressDisplay(currentAddress);
      });

      reverseGeocode(INITIAL_LAT, INITIAL_LNG);

      google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
        setTimeout(function() {
          document.getElementById('loading-overlay').style.display = 'none';
        }, 300);
      });

      document.getElementById('confirm-btn').addEventListener('click', function() {
        sendMessage({
          type: 'select',
          address: currentAddress,
          lat: currentLat,
          lng: currentLng
        });
      });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap&v=weekly" async defer></script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
