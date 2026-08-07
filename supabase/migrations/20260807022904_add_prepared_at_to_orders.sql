/*
# Add prepared_at column to orders table

1. Modified Tables
- `orders`: adds `prepared_at` column (timestamptz, nullable)
  - Stores the optional date/time the customer wants their order prepared by
  - Only populated when delivery_type = 'delivery' and the customer provides a value
  - Existing orders are unaffected (column defaults to NULL)

2. Security
- No RLS policy changes — existing order policies cover the new column automatically
- No new indexes needed (optional field, not queried for filtering)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'prepared_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN prepared_at timestamptz;
  END IF;
END $$;