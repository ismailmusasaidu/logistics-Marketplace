/*
  # Fix Rider Active Orders: Replace Incremental Counter with Count-Based Sync

  ## Problem
  The incremental trigger (increment/decrement on each order change) drifts over time
  because multi-column updates in a single statement only match one ELSIF branch,
  causing missed decrements. Both riders currently show active_orders=10 (the hard cap
  used by assign-rider edge function) while their real counts are 8 and 9, blocking
  all new rider assignments.

  ## Solution
  1. Immediately re-sync all rider active_orders to accurate counts
  2. Replace the incremental trigger with a count-based approach that recalculates
     the true count for affected riders on every order change — eliminating drift entirely

  ## Changes
  - Recalculates `active_orders` for ALL riders
  - Replaces `sync_rider_active_orders()` trigger function with count-based logic
  - Trigger fires on both INSERT and UPDATE to cover all cases
*/

-- Step 1: Immediately fix all rider counters
UPDATE riders r
SET active_orders = (
  SELECT COUNT(*)
  FROM orders o
  WHERE o.assigned_rider_id = r.id
    AND o.status NOT IN ('delivered', 'cancelled')
    AND o.assignment_status IN ('assigned', 'accepted')
);

-- Step 2: Replace trigger function with count-based approach
CREATE OR REPLACE FUNCTION sync_rider_active_orders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  rider_to_update uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_rider_id IS NOT NULL THEN
      UPDATE riders
      SET active_orders = (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.assigned_rider_id = NEW.assigned_rider_id
          AND o.status NOT IN ('delivered', 'cancelled')
          AND o.assignment_status IN ('assigned', 'accepted')
      )
      WHERE id = NEW.assigned_rider_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.assigned_rider_id IS NOT NULL THEN
      UPDATE riders
      SET active_orders = (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.assigned_rider_id = OLD.assigned_rider_id
          AND o.status NOT IN ('delivered', 'cancelled')
          AND o.assignment_status IN ('assigned', 'accepted')
      )
      WHERE id = OLD.assigned_rider_id;
    END IF;

    IF NEW.assigned_rider_id IS NOT NULL
       AND NEW.assigned_rider_id IS DISTINCT FROM OLD.assigned_rider_id THEN
      UPDATE riders
      SET active_orders = (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.assigned_rider_id = NEW.assigned_rider_id
          AND o.status NOT IN ('delivered', 'cancelled')
          AND o.assignment_status IN ('assigned', 'accepted')
      )
      WHERE id = NEW.assigned_rider_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 3: Recreate trigger for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_sync_rider_active_orders ON orders;

CREATE TRIGGER trigger_sync_rider_active_orders
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_rider_active_orders();
