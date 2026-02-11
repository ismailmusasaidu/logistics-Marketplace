/*
  # Add Pickup and Delivery Instructions to Orders

  1. Changes
    - Add `pickup_instructions` column to `orders` table
      - Optional text field for special instructions at pickup location
      - Examples: gate codes, parking info, contact person
    - Add `delivery_instructions` column to `orders` table
      - Optional text field for special instructions at delivery location
      - Examples: call on arrival, security procedures, floor/unit info

  2. Notes
    - Both fields are optional (nullable)
    - No default values
    - Existing orders will have NULL values for these fields
*/

-- Add pickup instructions column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_instructions'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_instructions text;
  END IF;
END $$;

-- Add delivery instructions column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_instructions'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_instructions text;
  END IF;
END $$;