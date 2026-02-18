/*
  # Fix products UPDATE RLS policy for vendor_id = profile.id

  ## Summary
  The products table stores vendor_id as the user's profile.id (not the vendors table id).
  The existing UPDATE policy checks vendors.id = products.vendor_id, which never matches
  because this app uses profile.id as vendor_id on products. This causes weight_kg (and
  all other product edits) to silently fail to save.

  ## Changes
  - Drop and recreate "Vendors can update own products" policy to also allow direct
    vendor_id = auth.uid() match (covers the case where vendor_id = profile.id).
*/

DROP POLICY IF EXISTS "Vendors can update own products" ON products;

CREATE POLICY "Vendors can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
        AND vendors.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    vendor_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
        AND vendors.user_id = (SELECT auth.uid())
    )
  );
