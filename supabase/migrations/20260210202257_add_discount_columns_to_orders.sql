/*
  # Add discount and promo columns to orders table

  1. Modified Tables
    - `orders`
      - `discount_amount` (numeric, default 0) - Amount discounted from the order
      - `promo_code` (text, nullable) - The promo code applied to the order
      - `promo_id` (uuid, nullable) - Reference to the promotion used

  2. Important Notes
    - Uses IF NOT EXISTS checks to avoid errors if columns already exist
    - These columns support the promo code / discount feature in checkout
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN discount_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'promo_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN promo_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'promo_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN promo_id uuid;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';