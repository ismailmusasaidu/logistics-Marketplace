/*
  # Add Rider Assignment to Orders

  1. Changes
    - Add `rider_id` column to `orders` table for logistics orders
    - Add foreign key constraint to `riders` table
    - Create index for efficient rider-based queries
    - Add RLS policy for riders to view their assigned orders

  2. Security
    - Riders can only view orders assigned to them
    - Admins can assign/reassign riders to orders
*/

-- Add rider_id column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rider_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_id uuid REFERENCES riders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient rider queries
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);

-- Create index for order_source queries
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(order_source);

-- Add policy for riders to view their assigned orders
DROP POLICY IF EXISTS "Riders can view assigned orders" ON orders;
CREATE POLICY "Riders can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  );

-- Add policy for riders to update their assigned orders (status updates)
DROP POLICY IF EXISTS "Riders can update assigned orders" ON orders;
CREATE POLICY "Riders can update assigned orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  );