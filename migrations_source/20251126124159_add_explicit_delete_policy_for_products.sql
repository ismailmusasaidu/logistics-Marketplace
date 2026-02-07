/*
  # Add explicit DELETE policy for products

  1. Changes
    - Drop the existing "ALL" policy for vendors
    - Create separate policies for SELECT, INSERT, UPDATE, and DELETE
    - This ensures DELETE operations work correctly with RLS

  2. Security
    - Vendors can only delete their own products
    - Admin can delete any product
*/

-- Drop existing vendor policy
DROP POLICY IF EXISTS "Vendors can manage own products" ON products;

-- Create separate policies for better control
CREATE POLICY "Vendors can view own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert own products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );
