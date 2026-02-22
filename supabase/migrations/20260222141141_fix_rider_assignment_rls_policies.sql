/*
  # Fix rider assignment RLS policies

  1. Problem
    - The SELECT policy "Users can view relevant orders" only checks `rider_id` for rider access
    - The UPDATE policy "Riders can update assigned orders" only checks `rider_id`
    - When an order is first assigned to a rider, it uses `assigned_rider_id` (not `rider_id`)
    - `rider_id` is only set after the rider accepts the assignment
    - This means riders cannot see or interact with newly assigned orders (the accept/reject popup never appears)

  2. Changes
    - Update SELECT policy to also check `assigned_rider_id` so riders can see pending assignments
    - Update UPDATE policy to also check `assigned_rider_id` so riders can accept/reject assignments

  3. Security
    - Riders can only see/update orders where their rider record ID matches either `rider_id` or `assigned_rider_id`
    - All existing access patterns (customer, vendor, admin) remain unchanged
*/

DROP POLICY IF EXISTS "Users can view relevant orders" ON orders;

CREATE POLICY "Users can view relevant orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    (customer_id = auth.uid())
    OR (vendor_user_id = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM riders
      WHERE riders.user_id = auth.uid()
        AND (riders.id = orders.rider_id OR riders.id = orders.assigned_rider_id)
    ))
    OR (EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    ))
  );

DROP POLICY IF EXISTS "Riders can update assigned orders" ON orders;

CREATE POLICY "Riders can update assigned orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.user_id = auth.uid()
        AND (riders.id = orders.rider_id OR riders.id = orders.assigned_rider_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.user_id = auth.uid()
        AND (riders.id = orders.rider_id OR riders.id = orders.assigned_rider_id)
    )
  );
