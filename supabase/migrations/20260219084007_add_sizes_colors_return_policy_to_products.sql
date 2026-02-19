/*
  # Add sizes, colors, and return_policy to products

  ## New Columns on `products`
  - `sizes` (text[]) — Optional array of size options (e.g., ["S", "M", "L", "XL"])
  - `colors` (text[]) — Optional array of color options (e.g., ["Red", "Blue", "Black"])
  - `return_policy` (text) — Optional free-text return policy description

  These are all optional (nullable). Existing products are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sizes'
  ) THEN
    ALTER TABLE products ADD COLUMN sizes text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'colors'
  ) THEN
    ALTER TABLE products ADD COLUMN colors text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'return_policy'
  ) THEN
    ALTER TABLE products ADD COLUMN return_policy text DEFAULT NULL;
  END IF;
END $$;
