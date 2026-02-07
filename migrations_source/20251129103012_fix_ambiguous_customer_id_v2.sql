/*
  # Fix ambiguous column reference in vendor customer visibility function

  1. Changes
    - Drop policy first (to avoid dependency issues)
    - Drop and recreate function with properly qualified column names
    - Recreate policy
  
  2. Security
    - Maintains vendor access control to customer profiles
    - No security changes, just fixing the SQL syntax
*/

-- Drop the policy first
DROP POLICY IF EXISTS "Vendors can view their order customers" ON profiles;

-- Drop the problematic function
DROP FUNCTION IF EXISTS is_vendor_viewing_customer(uuid);

-- Create corrected helper function with proper column qualification
CREATE OR REPLACE FUNCTION is_vendor_viewing_customer(profile_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.customer_id = profile_id
    AND orders.vendor_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate policy using the fixed function
CREATE POLICY "Vendors can view their order customers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_vendor_viewing_customer(id));