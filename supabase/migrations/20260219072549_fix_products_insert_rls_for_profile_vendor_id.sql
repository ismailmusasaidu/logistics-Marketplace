/*
  # Fix products INSERT and DELETE RLS policies for profile-based vendor_id

  ## Problem
  The products table FK requires vendor_id to reference profiles(id),
  so inserts use profile.id as vendor_id. However the INSERT and DELETE
  policies only checked vendors.id = products.vendor_id (the vendors table UUID),
  which never matches profile.id, causing RLS violations.

  ## Changes
  - Drop and recreate the INSERT policy to also allow vendor_id = auth.uid()
  - Drop and recreate the DELETE policy to also allow vendor_id = auth.uid()
*/

DROP POLICY IF EXISTS "Vendors can insert own products or admins can insert any" ON products;
DROP POLICY IF EXISTS "Vendors can delete own products or admins can delete all" ON products;

CREATE POLICY "Vendors can insert own products or admins can insert any"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (vendor_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
        AND vendors.user_id = (SELECT auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    ))
  );

CREATE POLICY "Vendors can delete own products or admins can delete all"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    (vendor_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
        AND vendors.user_id = (SELECT auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
      ))
  );
