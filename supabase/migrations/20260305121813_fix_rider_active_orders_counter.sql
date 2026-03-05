/*
  # Fix Rider Active Orders Counter

  ## Problem
  The `riders.active_orders` counter was being incremented when orders were assigned
  but never decremented when orders were completed (delivered/cancelled). This caused
  the counter to grow indefinitely, blocking rider assignment since the query filters
  for riders with active_orders < 10.

  ## Changes
  1. Backfills `active_orders` for all riders based on actual non-terminal orders
  2. Creates a trigger function that maintains `active_orders` accurately:
     - Increments when an order is assigned to a rider (assigned_rider_id set)
     - Decrements when an order reaches a terminal state (delivered or cancelled)
*/

-- Backfill active_orders to reflect actual current counts
UPDATE riders r
SET active_orders = (
  SELECT COUNT(*)
  FROM orders o
  WHERE o.assigned_rider_id = r.id
    AND o.status NOT IN ('delivered', 'cancelled')
);

-- Function to keep active_orders in sync
CREATE OR REPLACE FUNCTION sync_rider_active_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Order completed or cancelled — decrement old rider
  IF (NEW.status IN ('delivered', 'cancelled')) AND (OLD.status NOT IN ('delivered', 'cancelled')) THEN
    IF OLD.assigned_rider_id IS NOT NULL THEN
      UPDATE riders
      SET active_orders = GREATEST(0, active_orders - 1)
      WHERE id = OLD.assigned_rider_id;
    END IF;
  END IF;

  -- Rider was assigned (assigned_rider_id changed from null or different value)
  IF NEW.assigned_rider_id IS DISTINCT FROM OLD.assigned_rider_id THEN
    -- Decrement old rider if there was one and order is still active
    IF OLD.assigned_rider_id IS NOT NULL AND OLD.status NOT IN ('delivered', 'cancelled') THEN
      UPDATE riders
      SET active_orders = GREATEST(0, active_orders - 1)
      WHERE id = OLD.assigned_rider_id;
    END IF;

    -- Increment new rider if order is still active
    IF NEW.assigned_rider_id IS NOT NULL AND NEW.status NOT IN ('delivered', 'cancelled') THEN
      UPDATE riders
      SET active_orders = active_orders + 1
      WHERE id = NEW.assigned_rider_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_rider_active_orders ON orders;

CREATE TRIGGER trigger_sync_rider_active_orders
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_rider_active_orders();
