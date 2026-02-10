/*
  # Add order_source column to orders table

  1. Changes
    - Add `order_source` column to `orders` table with values 'marketplace' or 'logistics'
    - Default to 'marketplace' so existing orders are tagged correctly
    - Add index for fast filtering by source

  2. Purpose
    - Separates marketplace product orders from logistics delivery orders
    - Each app will only see its own orders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_source'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_source text NOT NULL DEFAULT 'marketplace';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(order_source);
