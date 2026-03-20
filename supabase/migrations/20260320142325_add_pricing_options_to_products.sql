/*
  # Add pricing_options column to products table

  ## Summary
  Adds a JSONB column `pricing_options` to the products table to store an
  array of pricing tiers that vendors can define per product.

  ## New Columns
  - `products.pricing_options` (jsonb, nullable) - Array of objects with
    shape `{ label: string, price: number }`, e.g.
    `[{"label":"Small","price":500},{"label":"Large","price":900}]`

  ## Notes
  - Column is nullable; products without pricing options remain unaffected
  - Existing SELECT * queries and TypeScript types already reference this field
  - Vendor AddProduct component already writes to this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'pricing_options'
  ) THEN
    ALTER TABLE products ADD COLUMN pricing_options jsonb DEFAULT NULL;
  END IF;
END $$;
