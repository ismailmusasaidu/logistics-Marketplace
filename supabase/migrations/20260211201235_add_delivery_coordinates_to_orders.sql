/*
  # Add Delivery Coordinates to Orders

  1. Changes
    - Add `delivery_lat` column to `orders` table
      - Stores latitude coordinate for delivery location
      - Type: double precision (numeric)
    - Add `delivery_lng` column to `orders` table
      - Stores longitude coordinate for delivery location
      - Type: double precision (numeric)
    - Add `pickup_lat` column to `orders` table
      - Stores latitude coordinate for pickup location
      - Type: double precision (numeric)
    - Add `pickup_lng` column to `orders` table
      - Stores longitude coordinate for pickup location
      - Type: double precision (numeric)

  2. Notes
    - All fields are optional (nullable)
    - Used for distance calculation and map display
    - Existing orders will have NULL values for these fields
*/

-- Add delivery latitude column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_lat'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_lat double precision;
  END IF;
END $$;

-- Add delivery longitude column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_lng'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_lng double precision;
  END IF;
END $$;

-- Add pickup latitude column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_lat'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_lat double precision;
  END IF;
END $$;

-- Add pickup longitude column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_lng'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_lng double precision;
  END IF;
END $$;