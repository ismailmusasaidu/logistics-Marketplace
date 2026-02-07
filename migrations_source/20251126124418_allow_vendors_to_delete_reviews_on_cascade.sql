/*
  # Allow vendors to delete reviews when deleting products

  1. Changes
    - Add policy allowing vendors to delete reviews on their own products
    - This enables CASCADE delete to work when vendors delete products

  2. Security
    - Only vendors can delete reviews on their own products
    - Users can still delete their own reviews
*/

CREATE POLICY "Vendors can delete reviews on own products"
  ON reviews
  FOR DELETE
  TO authenticated
  USING (
    product_id IN (
      SELECT p.id 
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );
