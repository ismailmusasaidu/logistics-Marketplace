/*
  # Restore Vendor Customer Visibility

  ## Overview
  Allows vendors to view profile information of customers who have ordered from them.
  Uses a safe subquery pattern that avoids infinite recursion.

  ## Changes Made
  
  ### 1. Profiles Table Policy
    - Add "Vendors can view customers who ordered from them" policy
    - Uses EXISTS with order lookup (not profiles lookup)
    - Avoids recursion by checking orders table directly
  
  ## Security Notes
  - Vendors can only see customers who have placed orders with them
  - Uses auth.uid() for current vendor identification
  - No circular dependency with profiles table
*/

-- Create vendor-customer visibility policy
CREATE POLICY "Vendors can view customers who ordered from them"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing customers who have orders from this vendor
    id IN (
      SELECT DISTINCT o.customer_id
      FROM orders o
      WHERE o.vendor_user_id = auth.uid()
    )
  );
