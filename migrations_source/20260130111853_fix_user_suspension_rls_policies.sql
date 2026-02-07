/*
  # Fix User Suspension RLS Policies

  1. Problem
    - Admins getting 500 error when suspending/unsuspending users
    - Foreign key constraint on suspended_by is being blocked by RLS
    - Need to allow FK checks to bypass RLS for system operations

  2. Solution
    - Drop and recreate is_admin() function with proper settings
    - Simplify UPDATE policies to avoid conflicts
    - Ensure foreign key checks work properly

  3. Security
    - Maintains admin-only control over suspension
    - Users still cannot modify their own suspension status
*/

-- Drop existing conflicting UPDATE policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own non-sensitive profile fields" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Recreate is_admin function with proper security settings
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a single, clear admin update policy
CREATE POLICY "Admins have full update access"
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

-- Create user self-update policy (non-privileged fields only)
CREATE POLICY "Users can update own basic profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND COALESCE(is_suspended, false) = COALESCE((SELECT is_suspended FROM profiles WHERE id = auth.uid()), false)
    AND suspended_at IS NOT DISTINCT FROM (SELECT suspended_at FROM profiles WHERE id = auth.uid())
    AND suspended_by IS NOT DISTINCT FROM (SELECT suspended_by FROM profiles WHERE id = auth.uid())
  );

-- Grant necessary permissions for FK constraint checks
GRANT SELECT ON profiles TO authenticated;
