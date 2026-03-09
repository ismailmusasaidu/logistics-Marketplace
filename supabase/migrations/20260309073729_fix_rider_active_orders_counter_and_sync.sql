
/*
  # Fix Rider Active Orders Counter

  ## Problem
  Both riders have `active_orders = 10` (the hard cap) even though their real
  active order counts are 8 and 9. This causes the assign-rider edge function
  to filter out ALL riders (query: `active_orders < 10`), resulting in no
  assignment for any new order.

  The counter drifted because:
  - The sync trigger tracks by `assigned_rider_id` but orders can transition
    without properly updating that field
  - Some edge cases in the trigger logic caused double-increments

  ## Fix
  1. Immediately recalculate and reset `active_orders` for all riders based
     on actual live orders (not delivered or cancelled, and has an assigned_rider_id)
  2. Rebuild the sync trigger with clearer, safer logic
*/

-- Step 1: Reset active_orders to accurate real-time counts
UPDATE riders r
SET active_orders = (
  SELECT COUNT(*)
  FROM orders o
  WHERE o.assigned_rider_id = r.id
    AND o.status NOT IN ('delivered', 'cancelled')
    AND o.assignment_status IN ('assigned', 'accepted')
);

-- Step 2: Rebuild the sync trigger with cleaner logic
CREATE OR REPLACE FUNCTION sync_rider_active_orders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Case 1: assigned_rider_id changed (reassignment or first assignment)
  IF NEW.assigned_rider_id IS DISTINCT FROM OLD.assigned_rider_id THEN
    -- Decrement previous rider if order was active
    IF OLD.assigned_rider_id IS NOT NULL
       AND OLD.status NOT IN ('delivered', 'cancelled')
       AND OLD.assignment_status IN ('assigned', 'accepted') THEN
      UPDATE riders
      SET active_orders = GREATEST(0, active_orders - 1)
      WHERE id = OLD.assigned_rider_id;
    END IF;

    -- Increment new rider if order is still active
    IF NEW.assigned_rider_id IS NOT NULL
       AND NEW.status NOT IN ('delivered', 'cancelled')
       AND NEW.assignment_status IN ('assigned', 'accepted') THEN
      UPDATE riders
      SET active_orders = active_orders + 1
      WHERE id = NEW.assigned_rider_id;
    END IF;

  -- Case 2: assignment_status changed (e.g. assigned → accepted, or reset to pending)
  ELSIF NEW.assignment_status IS DISTINCT FROM OLD.assignment_status THEN
    IF NEW.assigned_rider_id IS NOT NULL THEN
      -- Became active (assigned or accepted) from an inactive state
      IF NEW.assignment_status IN ('assigned', 'accepted')
         AND OLD.assignment_status NOT IN ('assigned', 'accepted')
         AND NEW.status NOT IN ('delivered', 'cancelled') THEN
        UPDATE riders
        SET active_orders = active_orders + 1
        WHERE id = NEW.assigned_rider_id;

      -- Became inactive (pending reset) from an active state
      ELSIF NEW.assignment_status = 'pending'
         AND OLD.assignment_status IN ('assigned', 'accepted') THEN
        UPDATE riders
        SET active_orders = GREATEST(0, active_orders - 1)
        WHERE id = OLD.assigned_rider_id;
      END IF;
    END IF;

  -- Case 3: order reached terminal status (delivered or cancelled)
  ELSIF NEW.status IN ('delivered', 'cancelled')
        AND OLD.status NOT IN ('delivered', 'cancelled') THEN
    IF OLD.assigned_rider_id IS NOT NULL THEN
      UPDATE riders
      SET active_orders = GREATEST(0, active_orders - 1)
      WHERE id = OLD.assigned_rider_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_rider_active_orders ON orders;

CREATE TRIGGER trigger_sync_rider_active_orders
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_rider_active_orders();
