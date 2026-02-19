/*
  # Fix product_images RLS policies for profile-based vendor_id

  ## Problem
  The product_images INSERT/UPDATE/DELETE policies join products -> vendors
  via vendors.id = products.vendor_id. Since products.vendor_id now stores
  profile.id (not vendors.id), this join never matches and RLS blocks the operation.

  ## Changes
  - Recreate INSERT, UPDATE, DELETE policies to also allow when
    products.vendor_id = auth.uid() directly (profile-based vendor path)
*/

DROP POLICY IF EXISTS "Vendors can insert their product images" ON product_images;
DROP POLICY IF EXISTS "Vendors can update their product images" ON product_images;
DROP POLICY IF EXISTS "Vendors can delete their product images" ON product_images;

CREATE POLICY "Vendors can insert their product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
        AND (
          p.vendor_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM vendors v
            WHERE v.id = p.vendor_id AND v.user_id = (SELECT auth.uid())
          )
        )
    )
  );

CREATE POLICY "Vendors can update their product images"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
        AND (
          p.vendor_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM vendors v
            WHERE v.id = p.vendor_id AND v.user_id = (SELECT auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
        AND (
          p.vendor_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM vendors v
            WHERE v.id = p.vendor_id AND v.user_id = (SELECT auth.uid())
          )
        )
    )
  );

CREATE POLICY "Vendors can delete their product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
        AND (
          p.vendor_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM vendors v
            WHERE v.id = p.vendor_id AND v.user_id = (SELECT auth.uid())
          )
        )
    )
  );
