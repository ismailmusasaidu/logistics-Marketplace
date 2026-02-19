/*
  # Add vendor read policy for order_items

  ## Problem
  The existing SELECT policy on order_items only allows customers (who placed the order)
  and admins to read order items. Vendors are excluded, so they see "No items found"
  when viewing order details in their dashboard.

  ## Change
  - Adds a new SELECT policy that allows vendors to read order_items for orders
    that belong to their store (matched via orders.vendor_user_id = auth.uid())
*/

CREATE POLICY "Vendors can view order items for their orders"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.vendor_user_id = auth.uid()
    )
  );
