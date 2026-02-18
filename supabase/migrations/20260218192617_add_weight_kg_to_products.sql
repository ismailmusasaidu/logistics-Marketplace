/*
  # Add weight_kg to products table

  ## Summary
  Adds a nullable `weight_kg` (numeric) column to the `products` table so vendors
  can specify the weight of their product in kilograms.

  ## Changes
  - `products` table: new optional column `weight_kg` (numeric, nullable, no default)

  ## Notes
  - Nullable so existing products are unaffected
  - No RLS changes needed; existing product policies already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'weight_kg'
  ) THEN
    ALTER TABLE products ADD COLUMN weight_kg numeric(10, 3);
  END IF;
END $$;
