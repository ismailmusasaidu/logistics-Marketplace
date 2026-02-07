/*
  # Fix Admin Access to Profiles

  1. Changes
    - Add policy to allow admins to view all profiles (without recursion)
    - Add policy to allow admins to update all profiles (for vendor approval)
  
  2. Security
    - Uses auth.jwt() to check role from JWT claims instead of querying profiles table
    - This avoids infinite recursion
*/

-- Allow admins to view all profiles using JWT claim
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Allow admins to update all profiles using JWT claim
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
