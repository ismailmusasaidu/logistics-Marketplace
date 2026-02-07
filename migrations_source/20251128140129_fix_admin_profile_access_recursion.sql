/*
  # Fix Infinite Recursion in Admin Profile Policy

  ## Overview
  The "Admins can update vendor profiles" policy causes infinite recursion because
  it queries the profiles table within a profiles table policy, creating a circular dependency.

  ## Changes Made
  
  ### 1. Drop Old Policy
    - Remove "Admins can update vendor profiles" policy
  
  ### 2. New Policy (No Recursion)
    - Rewritten to check auth.jwt() for role instead of querying profiles
    - Uses JWT metadata which is available without table queries
  
  ## Security Notes
  - Admins can still update vendor profiles
  - No circular policy references
  - More efficient as it doesn't query the database
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Admins can update vendor profiles" ON profiles;

-- Create new policy without circular reference using JWT
CREATE POLICY "Admins can update vendor profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin'
    OR auth.uid() = id
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin'
    OR auth.uid() = id
  );
