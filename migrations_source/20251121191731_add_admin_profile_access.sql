/*
  # Add Admin Access to Profiles

  1. Changes
    - Add policy to allow admins to view all profiles
    - Add policy to allow admins to update all profiles (for vendor approval)
  
  2. Security
    - Only users with role='admin' can view and update other profiles
    - Existing user policies remain unchanged
*/

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update all profiles (for vendor approval, etc.)
CREATE POLICY "Admins can update all profiles"
  ON profiles
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
