/*
  # Add Delivery Type to Orders

  1. Changes
    - Add `delivery_type` column to `orders` table (pickup or delivery)
    - Set default to 'pickup' for existing records

  2. Notes
    - This enables customers to choose between pickup and delivery
    - Delivery fee is already in the orders table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_type text NOT NULL DEFAULT 'pickup' CHECK (delivery_type IN ('pickup', 'delivery'));
  END IF;
END $$;
