/*
  # Add selected_size and selected_color to carts and order_items

  ## Summary
  Adds optional size and color variant fields so that when a customer selects
  a size or color from the product detail modal before adding to cart, that
  selection is persisted through checkout and visible on all order detail views.

  ## Changes
  - `carts` table: add `selected_size` (text, nullable) and `selected_color` (text, nullable)
  - `order_items` table: add `selected_size` (text, nullable) and `selected_color` (text, nullable)

  ## Notes
  - Both columns are nullable — products without variants simply leave them null
  - No RLS changes needed; these columns are on existing tables with existing policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'carts' AND column_name = 'selected_size'
  ) THEN
    ALTER TABLE carts ADD COLUMN selected_size text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'carts' AND column_name = 'selected_color'
  ) THEN
    ALTER TABLE carts ADD COLUMN selected_color text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'selected_size'
  ) THEN
    ALTER TABLE order_items ADD COLUMN selected_size text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'selected_color'
  ) THEN
    ALTER TABLE order_items ADD COLUMN selected_color text;
  END IF;
END $$;
