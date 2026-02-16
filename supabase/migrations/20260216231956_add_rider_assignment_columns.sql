/*
  # Add rider assignment and pickup columns

  1. Modified Tables
    - `orders`
      - `pickup_address` (text, nullable) - Separate pickup address for logistics orders
      - `assigned_rider_id` (uuid, nullable) - Rider assigned but not yet accepted
      - `assignment_status` (text, default 'pending') - Assignment workflow status
      - `assignment_timeout_at` (timestamptz, nullable) - When assignment expires
      - `assigned_at` (timestamptz, nullable) - When rider was assigned
      - `pickup_zone_id` (uuid, nullable) - Zone for pickup location
    - `riders`
      - `active_orders` (integer, default 0) - Number of currently active orders

  2. Security
    - RLS policies for riders to read orders assigned to them
    - RLS policies for riders to update assignment status on their assigned orders

  3. Notes
    - Backfills pickup_address from existing logistics orders that store combined addresses
    - Supports the rider assignment workflow (assign -> accept/reject -> reassign)
*/

-- Add missing columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_rider_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_rider_id uuid REFERENCES riders(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_timeout_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_timeout_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_zone_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_zone_id uuid REFERENCES zones(id);
  END IF;
END $$;

-- Add active_orders to riders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'active_orders'
  ) THEN
    ALTER TABLE riders ADD COLUMN active_orders integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for assignment queries
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider_id ON orders(assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_assignment_status ON orders(assignment_status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_zone_id ON orders(pickup_zone_id);

-- Backfill pickup_address from existing logistics orders
-- These have delivery_address in format "Pickup: X -> Delivery: Y"
UPDATE orders
SET pickup_address = TRIM(
  SUBSTRING(delivery_address FROM 'Pickup: (.+?) -> Delivery:')
)
WHERE order_source = 'logistics'
  AND pickup_address IS NULL
  AND delivery_address LIKE 'Pickup:%->%Delivery:%';

-- RLS: Allow riders to see orders assigned to them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Riders can view their assigned orders'
  ) THEN
    CREATE POLICY "Riders can view their assigned orders"
      ON orders FOR SELECT
      TO authenticated
      USING (
        assigned_rider_id IN (
          SELECT id FROM riders WHERE user_id = auth.uid()
        )
        OR rider_id IN (
          SELECT id FROM riders WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS: Allow riders to update assignment status on orders assigned to them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Riders can update their assigned orders'
  ) THEN
    CREATE POLICY "Riders can update their assigned orders"
      ON orders FOR UPDATE
      TO authenticated
      USING (
        assigned_rider_id IN (
          SELECT id FROM riders WHERE user_id = auth.uid()
        )
        OR rider_id IN (
          SELECT id FROM riders WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        assigned_rider_id IN (
          SELECT id FROM riders WHERE user_id = auth.uid()
        )
        OR rider_id IN (
          SELECT id FROM riders WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;