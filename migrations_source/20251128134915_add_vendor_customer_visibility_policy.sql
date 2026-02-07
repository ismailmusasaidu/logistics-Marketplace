/*
  # Allow Vendors to View Customer Profiles for Their Orders

  ## Overview
  This migration adds a policy that allows vendors to view customer profile information
  (name, email, phone) for customers who have placed orders with them.

  ## Changes Made
  
  ### 1. New RLS Policy
    - `Vendors can view customers who ordered from them` - Allows vendors to SELECT customer profiles
      - Checks if the vendor has any orders from that customer
      - Only applies to customer profiles (role = 'customer')
      - Vendors can only see customers who have placed orders with them
  
  ## Security Notes
  - Vendors can ONLY view customer information for their own orders
  - Vendors cannot view other vendors' customers
  - Vendors cannot view customer profiles without an order relationship
*/

-- Allow vendors to view customer profiles for their orders
CREATE POLICY "Vendors can view customers who ordered from them"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'customer'
    AND EXISTS (
      SELECT 1
      FROM orders o
      JOIN vendors v ON v.id = o.vendor_id
      WHERE o.customer_id = profiles.id
        AND v.user_id = auth.uid()
    )
  );
