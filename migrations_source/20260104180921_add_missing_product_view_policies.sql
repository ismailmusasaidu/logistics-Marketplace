/*
  # Add Missing Product View Policies

  1. Changes
    - Add policy for customers to view available products
    - Add policy for admins to view all products
    - These policies were missing, preventing customers from browsing products
    - Vendors already have their own view policy

  2. Security
    - Customers can view products where is_available = true
    - Admins can view all products
    - Vendors can view their own products (existing policy)
*/

-- Drop policies if they exist
DROP POLICY IF EXISTS "Customers can view available products" ON products;
DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

-- Policy for customers to view available products
CREATE POLICY "Customers can view available products"
  ON products FOR SELECT
  TO authenticated
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'customer'
    )
  );

-- Policy for admins to view all products
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins to manage all products
CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );