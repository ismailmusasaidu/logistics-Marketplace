/*
  # Add Order Status Timestamps

  1. Changes
    - Add timestamp columns for each order status to track when status changes occurred
    - Add columns: confirmed_at, preparing_at, ready_for_pickup_at, out_for_delivery_at, delivered_at, cancelled_at
    - These timestamps will be populated when the order status changes to the corresponding status

  2. Notes
    - Existing orders will have NULL timestamps for past statuses
    - Future status updates should set the appropriate timestamp
*/

-- Add timestamp columns for each order status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'preparing_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN preparing_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'ready_for_pickup_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN ready_for_pickup_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'out_for_delivery_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN out_for_delivery_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

-- Create or replace function to automatically set status timestamps
CREATE OR REPLACE FUNCTION update_order_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        NEW.confirmed_at = now();
      WHEN 'preparing' THEN
        NEW.preparing_at = now();
      WHEN 'ready_for_pickup' THEN
        NEW.ready_for_pickup_at = now();
      WHEN 'out_for_delivery' THEN
        NEW.out_for_delivery_at = now();
      WHEN 'delivered' THEN
        NEW.delivered_at = now();
      WHEN 'cancelled' THEN
        NEW.cancelled_at = now();
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_order_status_timestamp ON orders;

CREATE TRIGGER set_order_status_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_timestamp();