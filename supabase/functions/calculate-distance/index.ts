import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DistanceRequest {
  pickupAddress: string;
  deliveryAddress: string;
}

interface DistanceMatrixResult {
  distance: number;
  duration: number;
  pickupAddress: string;
  deliveryAddress: string;
}

async function calculateDistanceWithMatrix(
  pickupAddress: string,
  deliveryAddress: string
): Promise<DistanceMatrixResult | null> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

  if (!apiKey) {
    console.error('Google Maps API key not configured');
    throw new Error('Google Maps API key not configured. Please check GOOGLE_MAPS_SETUP.md for setup instructions.');
  }

  const normalizeAddress = (addr: string): string => {
    const trimmed = addr.trim();
    if (/\bNigeria\b/i.test(trimmed)) return trimmed;
    return `${trimmed}, Nigeria`;
  };

  try {
    const normalizedPickup = normalizeAddress(pickupAddress);
    const normalizedDelivery = normalizeAddress(deliveryAddress);

    const origins = encodeURIComponent(normalizedPickup);
    const destinations = encodeURIComponent(normalizedDelivery);

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&key=${apiKey}&region=ng`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = data.rows[0].elements[0];
      const distanceInMeters = element.distance.value;
      const distanceInKm = Math.round((distanceInMeters / 1000) * 10) / 10;
      const durationInSeconds = element.duration.value;
      const durationInMinutes = Math.round(durationInSeconds / 60);

      return {
        distance: distanceInKm,
        duration: durationInMinutes,
        pickupAddress: data.origin_addresses[0] || normalizedPickup,
        deliveryAddress: data.destination_addresses[0] || normalizedDelivery,
      };
    }

    console.error('Distance Matrix failed:', data.status, data.error_message, 'element:', data.rows?.[0]?.elements?.[0]?.status);

    // Fallback: geocode both addresses and compute straight-line distance
    const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=ng`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
        return geoData.results[0].geometry.location;
      }
      return null;
    };

    const [pickupCoord, deliveryCoord] = await Promise.all([
      geocode(normalizedPickup),
      geocode(normalizedDelivery),
    ]);

    if (!pickupCoord || !deliveryCoord) {
      console.error('Geocode fallback failed for addresses');
      return null;
    }

    // Haversine formula for straight-line distance
    const R = 6371;
    const dLat = (deliveryCoord.lat - pickupCoord.lat) * Math.PI / 180;
    const dLng = (deliveryCoord.lng - pickupCoord.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(pickupCoord.lat * Math.PI / 180) * Math.cos(deliveryCoord.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLineKm = Math.round(R * c * 10) / 10;
    // Add ~30% to account for road distance being longer than straight-line
    const estimatedKm = Math.round(straightLineKm * 1.3 * 10) / 10;

    return {
      distance: estimatedKm,
      duration: Math.round(estimatedKm * 3),
      pickupAddress: normalizedPickup,
      deliveryAddress: normalizedDelivery,
    };
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { pickupAddress, deliveryAddress }: DistanceRequest = await req.json();

    if (!pickupAddress || !deliveryAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: pickupAddress, deliveryAddress' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const result = await calculateDistanceWithMatrix(pickupAddress, deliveryAddress);

    if (!result) {
      return new Response(
        JSON.stringify({
          error: 'Unable to find address. Please use detailed addresses with landmarks (e.g., "10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos")'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error calculating distance:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConfigError = errorMessage.includes('API key not configured');

    return new Response(
      JSON.stringify({
        error: errorMessage,
        hint: isConfigError
          ? 'Please set up Google Maps API key. See GOOGLE_MAPS_SETUP.md for instructions.'
          : 'Please ensure addresses are detailed with area names and landmarks.'
      }),
      {
        status: isConfigError ? 503 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});