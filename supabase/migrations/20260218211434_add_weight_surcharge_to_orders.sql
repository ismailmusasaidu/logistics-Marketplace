/*
  # Add weight surcharge fields to orders table

  1. Changes
    - `weight_surcharge_amount` (numeric, default 0) — the monetary charge applied for heavy items
    - `weight_surcharge_label` (text, nullable) — the tier label for display on receipts

  2. Notes
    - Non-destructive: adds columns only, no data lost
    - Default 0 ensures existing orders remain valid
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'weight_surcharge_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN weight_surcharge_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'weight_surcharge_label'
  ) THEN
    ALTER TABLE orders ADD COLUMN weight_surcharge_label text;
  END IF;
END $$;
