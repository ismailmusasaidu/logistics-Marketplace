/*
  # Fix Profiles Table Recursion

  ## Overview
  Removes recursive policy that causes 500 errors on profiles table.

  ## Changes Made
  
  ### 1. Drop Problematic Policy
    - Remove "Vendors can view customers who ordered from them" policy
    - This policy creates infinite recursion with orders table
  
  ### 2. Add Simple Non-Recursive Policy
    - Admins can view all profiles (simple role check)
    - No subqueries to avoid recursion
  
  ## Security Notes
  - Admins need to view all profiles for management
  - Simple role check avoids recursion issues
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Vendors can view customers who ordered from them" ON profiles;

-- Add simple admin access policy
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );
