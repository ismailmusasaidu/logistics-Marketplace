/*
  # Add Order Size to Orders

  1. Changes
    - Add `order_size` column to `orders` table
      - Stores the size category of an order: 'small', 'medium', or 'large'
      - Type: text (nullable)
      - Used for pricing calculation and order management
      - Check constraint to ensure only valid values

  2. Notes
    - Field is optional (nullable)
    - Existing orders will have NULL values for this field
    - Used in conjunction with order_size_pricing for dynamic pricing
*/

-- Add order_size column with check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_size'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_size text;
    ALTER TABLE orders ADD CONSTRAINT order_size_check CHECK (order_size IN ('small', 'medium', 'large') OR order_size IS NULL);
  END IF;
END $$;