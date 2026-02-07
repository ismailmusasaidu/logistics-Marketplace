/*
  # Add discount fields to products table

  1. Modified Tables
    - `products`
      - `discount_percentage` (integer, default 0) - The discount percentage (0-100) to apply to the product price
      - `discount_active` (boolean, default false) - Whether the discount is currently active

  2. Notes
    - Vendors can set a discount percentage when adding or editing products
    - When discount_active is true and discount_percentage > 0, the customer sees a discount badge on the product card
    - The discounted price is calculated on the frontend as: price * (1 - discount_percentage / 100)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_percentage integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'discount_active'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_active boolean DEFAULT false;
  END IF;
END $$;
