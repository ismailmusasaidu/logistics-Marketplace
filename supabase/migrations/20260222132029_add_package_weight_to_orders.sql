/*
  # Add package_weight column to orders table

  1. Modified Tables
    - `orders`
      - Added `package_weight` (numeric, nullable) - stores the weight of the package in kg

  2. Notes
    - This column is used by bulk order creation in the logistics app
    - Nullable since not all orders require a package weight
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'package_weight' AND table_schema = 'public'
  ) THEN
    ALTER TABLE orders ADD COLUMN package_weight numeric;
  END IF;
END $$;