/*
  # Allow vendors to view customer profiles for their orders

  1. New Policy
    - Add policy to allow vendors to view customer profiles who have placed orders with them
    - Vendors can only see customer info for orders associated with their vendor_id
  
  2. Security
    - Policy ensures vendors can only access customer data for their own orders
    - Uses EXISTS clause to verify the relationship through the orders table
*/

-- Allow vendors to view customer profiles for orders they received
CREATE POLICY "Vendors can view customers who ordered from them"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT DISTINCT o.customer_id
      FROM orders o
      INNER JOIN vendors v ON v.id = o.vendor_id
      WHERE v.user_id = auth.uid()
    )
  );