/*
  # Simplify Admin Access to Profiles

  1. Changes
    - Allow users to view profiles with role='vendor' or 'admin' (for admin dashboard)
    - Allow admins to update vendor profiles (for approval)
  
  2. Security
    - Simplified approach: allow viewing vendor/admin profiles for dashboard
    - Admin updates still require checking the user's own role
*/

-- Allow authenticated users to view vendor and admin profiles (for display in admin dashboard)
CREATE POLICY "Users can view vendor and admin profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role IN ('vendor', 'admin')
  );

-- Allow users to update profiles if they are admin
-- We check the updater's role by joining against their own profile
CREATE POLICY "Admins can update vendor profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- The user making the request must be an admin
    -- We check this by seeing if their own ID has admin role
    auth.uid() IN (
      SELECT id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Same check for the WITH CHECK clause
    auth.uid() IN (
      SELECT id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
