/*
  # Add Store Pickup Address to Delivery Pricing

  ## Summary
  Adds a `store_pickup_address` column to the `delivery_pricing` table so admin
  can configure the marketplace store's physical address. This address is used
  as the origin point when calculating delivery distances for customer orders.

  ## Changes
  - `delivery_pricing` table: adds `store_pickup_address` (text, nullable)

  ## Notes
  - The address should be a full, detailed address including landmarks
    so the Google Maps Distance Matrix API can resolve it accurately
  - Existing rows are unaffected (column defaults to NULL)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_pricing' AND column_name = 'store_pickup_address'
  ) THEN
    ALTER TABLE delivery_pricing ADD COLUMN store_pickup_address text DEFAULT '';
  END IF;
END $$;
