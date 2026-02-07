/*
  # Fix Admin User Management Policies

  1. Changes
    - Drop conflicting UPDATE policies
    - Recreate UPDATE policies with proper logic
    - Ensure admins can update any user
    - Ensure users can only update their own non-sensitive fields
  
  2. Security
    - Admins have full control over all profiles
    - Users cannot change their own role or suspension status
*/

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Create new policy for admins with full control
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create policy for users to update their own non-sensitive fields
CREATE POLICY "Users can update own non-sensitive profile fields"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Ensure users cannot change these protected fields
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND is_suspended = (SELECT is_suspended FROM profiles WHERE id = auth.uid())
    AND suspended_at IS NOT DISTINCT FROM (SELECT suspended_at FROM profiles WHERE id = auth.uid())
    AND suspended_by IS NOT DISTINCT FROM (SELECT suspended_by FROM profiles WHERE id = auth.uid())
  );