import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AssignRiderRequest {
  order_id: string;
}

interface Zone {
  id: string;
  name: string;
}

interface ZoneWithDistance {
  zone: Zone;
  distanceMeters: number;
}

async function rankZonesByDistance(
  pickupAddress: string,
  zones: Zone[]
): Promise<ZoneWithDistance[]> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return [];
  }

  try {
    const origin = encodeURIComponent(
      pickupAddress.includes('Nigeria') ? pickupAddress : `${pickupAddress}, Nigeria`
    );

    const destinations = zones
      .map(zone => encodeURIComponent(`${zone.name}, Nigeria`))
      .join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations}&mode=driving&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.status, data.error_message);
      return [];
    }

    if (!data.rows || data.rows.length === 0 || !data.rows[0].elements) {
      console.error('No results from Distance Matrix API');
      return [];
    }

    const elements = data.rows[0].elements;
    const ranked: ZoneWithDistance[] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.status === 'OK' && element.distance) {
        ranked.push({
          zone: zones[i],
          distanceMeters: element.distance.value,
        });
      }
    }

    ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);

    console.log(
      'Zones ranked by distance:',
      ranked.map(r => `${r.zone.name} (${(r.distanceMeters / 1000).toFixed(2)}km)`).join(', ')
    );

    return ranked;
  } catch (error) {
    console.error('Error ranking zones by distance:', error);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id }: AssignRiderRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, pickup_zone_id, pickup_address, assignment_status, assigned_rider_id')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found', details: orderError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.assignment_status === 'accepted') {
      return new Response(
        JSON.stringify({ success: false, message: 'Order already accepted by a rider' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: allZones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('is_active', true);

    if (zonesError || !allZones || allZones.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No active zones found in the system' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the zone search order:
    // Start with the order's assigned zone (if any), then remaining zones ranked by distance
    let orderedZones: Zone[] = [];

    if (order.pickup_zone_id) {
      const assignedZone = allZones.find(z => z.id === order.pickup_zone_id);
      const otherZones = allZones.filter(z => z.id !== order.pickup_zone_id);

      if (assignedZone) {
        orderedZones.push(assignedZone);
      }

      if (otherZones.length > 0) {
        const ranked = await rankZonesByDistance(order.pickup_address, otherZones);
        orderedZones = orderedZones.concat(ranked.map(r => r.zone));
      }
    } else {
      // No zone set — rank all zones by distance
      console.log('No zone assigned, ranking all zones by distance...');
      const ranked = await rankZonesByDistance(order.pickup_address, allZones);

      if (ranked.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Could not determine closest zone. Please check Google Maps API configuration.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      orderedZones = ranked.map(r => r.zone);

      // Persist the closest zone on the order
      const closestZoneId = orderedZones[0].id;
      await supabase
        .from('orders')
        .update({ pickup_zone_id: closestZoneId })
        .eq('id', order_id);

      console.log(`Updated order ${order_id} with closest zone: ${orderedZones[0].name}`);
    }

    // Try each zone in distance order until a rider is found
    for (const zone of orderedZones) {
      console.log(`Searching for riders in zone: ${zone.name} (${zone.id})`);

      const { data: riders, error: ridersError } = await supabase
        .from('riders')
        .select('id, active_orders, zone_id')
        .eq('status', 'online')
        .eq('zone_id', zone.id)
        .lt('active_orders', 10)
        .order('active_orders', { ascending: true })
        .limit(1);

      if (ridersError) {
        console.error(`Error fetching riders for zone ${zone.name}:`, ridersError);
        continue;
      }

      if (!riders || riders.length === 0) {
        console.log(`No available riders in zone: ${zone.name}, trying next closest zone...`);
        continue;
      }

      const selectedRider = riders[0];
      const timeoutAt = new Date();
      timeoutAt.setMinutes(timeoutAt.getMinutes() + 3);

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          assigned_rider_id: selectedRider.id,
          pickup_zone_id: zone.id,
          assignment_status: 'assigned',
          assigned_at: new Date().toISOString(),
          assignment_timeout_at: timeoutAt.toISOString(),
        })
        .eq('id', order_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to assign rider', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Rider ${selectedRider.id} assigned from zone: ${zone.name}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Rider assigned successfully from zone: ${zone.name}`,
          rider_id: selectedRider.id,
          zone_id: zone.id,
          zone_name: zone.name,
          timeout_at: timeoutAt.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All zones exhausted
    return new Response(
      JSON.stringify({
        success: false,
        message: 'No available riders found in any zone. Order will remain pending.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in assign-rider:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
