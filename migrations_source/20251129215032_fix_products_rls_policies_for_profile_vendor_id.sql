/*
  # Fix Products RLS Policies for Profile-based Vendor ID

  1. Changes
    - Drop old vendor RLS policies that check vendors.id
    - Create new vendor RLS policies that check vendor_id = auth.uid()
    - Keep admin policies unchanged
    
  2. Security
    - Vendors can only manage products where vendor_id matches their profile ID
    - Admins can manage all products
    - Authenticated users can view available products
*/

-- Drop old vendor policies
DROP POLICY IF EXISTS "Vendors can insert own products" ON products;
DROP POLICY IF EXISTS "Vendors can update own products" ON products;
DROP POLICY IF EXISTS "Vendors can delete own products" ON products;
DROP POLICY IF EXISTS "Vendors can view own products" ON products;

-- Create new vendor policies using profile.id
CREATE POLICY "Vendors can insert own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
      AND profiles.vendor_status = 'approved'
    )
  );

CREATE POLICY "Vendors can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
    )
  );

CREATE POLICY "Vendors can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
    )
  );

CREATE POLICY "Vendors can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
    )
  );
