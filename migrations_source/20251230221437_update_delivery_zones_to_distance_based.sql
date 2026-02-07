/*
  # Update Delivery Zones to Distance-Based System

  1. Changes
    - Remove coordinate-based fields (latitude, longitude, radius_km)
    - Remove complex pricing fields (base_price, price_per_km)
    - Add simple distance range fields (min_distance_km, max_distance_km)
    - Add single flat price field
  
  2. New Fields
    - `min_distance_km` - Minimum distance for this zone (e.g., 0)
    - `max_distance_km` - Maximum distance for this zone (e.g., 3)
    - `price` - Flat delivery price for this zone
  
  3. Security
    - Maintain existing RLS policies
*/

-- Add new distance-based fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_zones' AND column_name = 'min_distance_km'
  ) THEN
    ALTER TABLE delivery_zones ADD COLUMN min_distance_km decimal(10, 2) NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_zones' AND column_name = 'max_distance_km'
  ) THEN
    ALTER TABLE delivery_zones ADD COLUMN max_distance_km decimal(10, 2) NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_zones' AND column_name = 'price'
  ) THEN
    ALTER TABLE delivery_zones ADD COLUMN price decimal(10, 2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Remove old coordinate-based and complex pricing fields
ALTER TABLE delivery_zones 
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS radius_km,
  DROP COLUMN IF EXISTS base_price,
  DROP COLUMN IF EXISTS price_per_km;

-- Update zone_id references in delivery_addresses to be nullable since zones work differently now
ALTER TABLE delivery_addresses ALTER COLUMN zone_id DROP NOT NULL;
