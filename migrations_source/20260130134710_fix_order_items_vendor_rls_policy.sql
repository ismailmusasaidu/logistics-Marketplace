/*
  # Fix Order Items RLS Policy for Vendors

  ## Overview
  Update the order_items RLS policy to use the denormalized vendor_user_id field
  from the orders table instead of joining the vendors table. This fixes the issue
  where vendors cannot see order items when generating receipts.

  ## Changes Made
  
  ### 1. Drop Old Policy
    - Remove "Users can view own order items" policy that joins vendors table
  
  ### 2. Create New Policy
    - Use vendor_user_id directly from orders table
    - Simpler query, better performance
    - Fixes receipt generation for vendors

  ## Security Notes
  - Customers can view their own order items
  - Vendors can view order items for orders they fulfilled
  - Admins have separate policy for viewing all order items
*/

-- Drop the old policy that joins vendors table
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

-- Create new policy using vendor_user_id from orders
CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id
      FROM orders
      WHERE customer_id = auth.uid()
         OR vendor_user_id = auth.uid()
    )
  );
