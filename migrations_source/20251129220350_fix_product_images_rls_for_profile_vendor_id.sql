/*
  # Fix Product Images RLS Policies for Profile-Based Vendor ID

  1. Changes
    - Drop old policies that check vendors table
    - Create new policies that check products.vendor_id directly against profile.id
    - Vendors can insert, update, and delete images for their own products
    - Everyone can view product images

  2. Security
    - Vendors can only manage images for products they own (vendor_id = auth.uid())
    - Public read access for all product images
*/

-- Drop old policies
DROP POLICY IF EXISTS "Vendors can insert their product images" ON product_images;
DROP POLICY IF EXISTS "Vendors can update their product images" ON product_images;
DROP POLICY IF EXISTS "Vendors can delete their product images" ON product_images;
DROP POLICY IF EXISTS "Anyone can view product images" ON product_images;

-- Create new policies using profile.id as vendor_id
CREATE POLICY "Anyone can view product images"
  ON product_images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Vendors can insert their product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their product images"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can delete their product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  );
