/*
  # Add Admin Delete Policies

  1. Changes
    - Make order_items.product_id nullable to preserve order history
    - Fix cascading deletes for order_items when products are deleted
    - Clean up orphaned products
    - Add DELETE policy for admins to delete users from profiles table
    - Add CASCADE delete for related records (carts, reviews, products)
  
  2. Security
    - Only admins can delete users
    - Maintains data integrity through cascading deletes
    - Preserves order history even when products/users are deleted
*/

-- Make order_items.product_id nullable to preserve order history
ALTER TABLE order_items 
  ALTER COLUMN product_id DROP NOT NULL;

-- Fix order_items to SET NULL when product is deleted (preserve order history)
ALTER TABLE order_items 
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE order_items 
  ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES products(id) 
  ON DELETE SET NULL;

-- Now delete orphaned products (products with non-existent vendors)
DELETE FROM products 
WHERE vendor_id NOT IN (SELECT id FROM profiles);

-- Enable admins to delete any profile
CREATE POLICY "Admins can delete users"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  );

-- Ensure carts cascade delete when user is deleted
ALTER TABLE carts 
  DROP CONSTRAINT IF EXISTS carts_user_id_fkey;

ALTER TABLE carts 
  ADD CONSTRAINT carts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Ensure reviews cascade delete when user is deleted
ALTER TABLE reviews 
  DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

ALTER TABLE reviews 
  ADD CONSTRAINT reviews_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Ensure products cascade delete when vendor is deleted
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_vendor_id_fkey;

ALTER TABLE products 
  ADD CONSTRAINT products_vendor_id_fkey 
  FOREIGN KEY (vendor_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;