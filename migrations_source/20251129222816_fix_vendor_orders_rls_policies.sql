/*
  # Fix Vendor Orders RLS Policies

  1. Changes
    - Drop old policies that check vendor_user_id
    - Create new policies that check vendor_id directly
    - Since vendor_id now references profiles.id, we can check it directly against auth.uid()

  2. Security
    - Vendors can only view/update/delete orders where vendor_id = auth.uid()
    - Maintains same security level as before
*/

-- Drop old vendor policies
DROP POLICY IF EXISTS "Vendors can view own orders via user_id" ON orders;
DROP POLICY IF EXISTS "Vendors can update own orders via user_id" ON orders;
DROP POLICY IF EXISTS "Vendors can delete own orders via user_id" ON orders;

-- Create new vendor policies using vendor_id
CREATE POLICY "Vendors can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can update own orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Vendors can delete own orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING (vendor_id = auth.uid());
