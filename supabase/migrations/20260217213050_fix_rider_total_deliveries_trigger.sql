/*
  # Fix Rider Total Deliveries Counter

  ## Problem
  The `riders.total_deliveries` column was always 0 because no trigger existed
  to increment it when an order status changes to 'delivered'.

  ## Changes
  1. Creates a trigger function that increments `total_deliveries` on the riders
     table when an order transitions to 'delivered' status.
  2. Creates the trigger on the orders table.
  3. Backfills the current `total_deliveries` count for all existing riders
     based on their actual delivered orders.
*/

CREATE OR REPLACE FUNCTION update_rider_total_deliveries()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    UPDATE riders
    SET total_deliveries = total_deliveries + 1
    WHERE id = NEW.rider_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_rider_total_deliveries ON orders;

CREATE TRIGGER trigger_update_rider_total_deliveries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_rider_total_deliveries();

UPDATE riders r
SET total_deliveries = (
  SELECT COUNT(*)
  FROM orders o
  WHERE o.rider_id = r.id
    AND o.status = 'delivered'
);
