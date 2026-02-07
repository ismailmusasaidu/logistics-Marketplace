/*
  # Add Admin Access to Orders

  ## Overview
  Allows admins to view, update, and delete all orders for platform management.

  ## Changes Made
  
  ### 1. Orders Table Policies
    - Add "Admins can view all orders" policy for SELECT
    - Add "Admins can update all orders" policy for UPDATE
    - Add "Admins can delete all orders" policy for DELETE
  
  ## Security Notes
  - Only users with role='admin' can access all orders
  - Uses profile lookup with auth.uid() for verification
*/

-- Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update all orders
CREATE POLICY "Admins can update all orders"
  ON orders
  FOR UPDATE
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

-- Allow admins to delete all orders
CREATE POLICY "Admins can delete all orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
