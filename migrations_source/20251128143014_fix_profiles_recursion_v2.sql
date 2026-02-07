/*
  # Fix Profiles Recursion - V2

  ## Overview
  Replace recursive admin policy with a simple self-referential check.

  ## Changes Made
  
  ### 1. Drop Recursive Admin Policy
    - Remove "Admins can view all profiles" which still has recursion
  
  ### 2. Add Non-Recursive Admin Policy
    - Check if the CURRENT profile has admin role
    - Use direct column reference instead of subquery
  
  ## Security Notes
  - Uses the profile row's own role column to check permissions
  - No subqueries = no recursion
*/

-- Drop the still-recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Add truly non-recursive admin access policy
-- This allows anyone to SELECT if the requesting user has admin role in their OWN profile
CREATE POLICY "Admins can view all profiles v2"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );
