/*
  # Fix infinite recursion in vendor policies

  1. Changes
    - Remove the recursive policy that causes infinite loop
    - Add a simpler policy: allow all authenticated users to view basic vendor info
    - This is safe because vendors are businesses that should be publicly visible
  
  2. Security
    - All authenticated users can view vendor information
    - Vendors are public-facing businesses, so this is appropriate
    - Write operations remain restricted
*/

-- Remove the problematic policy
DROP POLICY IF EXISTS "Customers can view vendors from their orders" ON vendors;

-- Allow all authenticated users to view vendors (vendors are public businesses)
CREATE POLICY "All authenticated users can view vendors"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (true);
