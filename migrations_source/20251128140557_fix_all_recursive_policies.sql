/*
  # Fix All Recursive Policies

  ## Overview
  Multiple policies create circular dependencies between profiles and orders tables.
  This migration fixes all recursive policies to eliminate infinite recursion.

  ## Changes Made
  
  ### 1. Orders Table Policies
    - Drop "Admins can manage all orders" (causes recursion by checking profiles)
    - Drop "Vendors can view own orders" (uses vendors table join)
    - Drop "Vendors can update own orders" (uses vendors table join)
    - Drop "Vendors can delete own orders" (incorrect check)
    - Create new policies using vendor_user_id column (no table joins)
  
  ### 2. Profiles Table Policies
    - Keep existing policies (already fixed to use vendor_user_id)
  
  ## Security Notes
  - Customers can view and manage their own orders
  - Vendors can view and manage orders using vendor_user_id (no recursion)
  - Admin management can be done via edge functions if needed
*/

-- Drop problematic orders policies
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Vendors can view own orders" ON orders;
DROP POLICY IF EXISTS "Vendors can update own orders" ON orders;
DROP POLICY IF EXISTS "Vendors can delete own orders" ON orders;

-- Create new non-recursive vendor policies using vendor_user_id
CREATE POLICY "Vendors can view own orders via user_id"
  ON orders
  FOR SELECT
  TO authenticated
  USING (vendor_user_id = auth.uid());

CREATE POLICY "Vendors can update own orders via user_id"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (vendor_user_id = auth.uid())
  WITH CHECK (vendor_user_id = auth.uid());

CREATE POLICY "Vendors can delete own orders via user_id"
  ON orders
  FOR DELETE
  TO authenticated
  USING (vendor_user_id = auth.uid());
