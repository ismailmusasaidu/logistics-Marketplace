/*
  # Add expected_delivery_days to products

  ## New Column on `products`
  - `expected_delivery_days` (integer) — Optional estimated delivery time in days set by the vendor.
    Null means no estimate provided.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'expected_delivery_days'
  ) THEN
    ALTER TABLE products ADD COLUMN expected_delivery_days integer DEFAULT NULL;
  END IF;
END $$;
