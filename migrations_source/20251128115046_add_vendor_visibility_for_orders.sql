/*
  # Allow customers to view vendor info through orders

  1. Changes
    - Add policy for customers to view vendor information when they have an order with that vendor
    - This enables the order tracking page to display vendor details
  
  2. Security
    - Customers can only see vendor info for vendors they have orders with
    - Maintains data privacy while enabling order tracking functionality
*/

-- Drop policy if it exists, then create it
DROP POLICY IF EXISTS "Customers can view vendors from their orders" ON vendors;

-- Allow customers to view vendors they have orders with
CREATE POLICY "Customers can view vendors from their orders"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM orders 
      WHERE orders.vendor_id = vendors.id 
        AND orders.customer_id = auth.uid()
    )
  );
