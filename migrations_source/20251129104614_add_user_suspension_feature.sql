/*
  # Add User Suspension Feature

  1. Changes
    - Add is_suspended column to profiles table
    - Add suspended_at timestamp column
    - Add suspended_by column to track which admin suspended the user
    - Add RLS policies to allow admins to update and delete users
  
  2. Security
    - Only admins can suspend/unsuspend users
    - Only admins can update user profiles
    - Only admins can delete users
*/

-- Add suspension columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_suspended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Create helper function to check if user is admin
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

-- Drop existing restrictive policies for profiles if they exist
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow users to update their own profile (but not role or suspension fields)
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Users cannot change their own role or suspension status
      (SELECT role FROM profiles WHERE id = auth.uid()) = role
      AND (SELECT is_suspended FROM profiles WHERE id = auth.uid()) = is_suspended
      AND (SELECT suspended_at FROM profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM suspended_at
      AND (SELECT suspended_by FROM profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM suspended_by
    )
  );

-- Allow admins to update any user profile
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow admins to delete any user
CREATE POLICY "Admins can delete any user"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_admin());