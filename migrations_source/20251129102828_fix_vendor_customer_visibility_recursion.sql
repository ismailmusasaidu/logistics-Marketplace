/*
  # Fix infinite recursion in vendor customer visibility policy

  1. Changes
    - Drop the problematic policy that causes infinite recursion
    - Create a new policy that uses a simpler approach without recursion
    - Use a function to check vendor access to avoid circular dependencies
  
  2. Security
    - Vendors can only see customer profiles for their orders
    - No circular policy dependencies
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Vendors can view customers who ordered from them" ON profiles;

-- Create a helper function to check if a user is a vendor viewing their customer
CREATE OR REPLACE FUNCTION is_vendor_viewing_customer(customer_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = customer_id
    AND o.vendor_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new policy using the helper function
CREATE POLICY "Vendors can view their order customers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_vendor_viewing_customer(id));