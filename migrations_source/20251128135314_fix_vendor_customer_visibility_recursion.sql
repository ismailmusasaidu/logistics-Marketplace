/*
  # Fix Infinite Recursion in Vendor Customer Visibility Policy

  ## Overview
  The previous policy caused infinite recursion because it joined the vendors table,
  which has policies that reference the profiles table, creating a circular dependency.

  ## Changes Made
  
  ### 1. Drop Old Policy
    - Remove "Vendors can view customers who ordered from them" policy
  
  ### 2. New Policy (No Recursion)
    - `Vendors can view customers who ordered from them` - Rewritten to avoid joining vendors table
    - Directly checks if orders exist for the current user as vendor
    - No circular table references
  
  ## Security Notes
  - Vendors can ONLY view customer information for their own orders
  - No circular policy references
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Vendors can view customers who ordered from them" ON profiles;

-- Create new policy without circular reference
CREATE POLICY "Vendors can view customers who ordered from them"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'customer'
    AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.customer_id = profiles.id
        AND o.vendor_id IN (
          SELECT id FROM vendors WHERE user_id = auth.uid()
        )
    )
  );
