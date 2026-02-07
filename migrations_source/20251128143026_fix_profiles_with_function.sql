/*
  # Fix Profiles Recursion with Security Definer Function

  ## Overview
  Use a security definer function to check admin role without recursion.

  ## Changes Made
  
  ### 1. Create Helper Function
    - `is_admin()` function that checks if current user is admin
    - Uses SECURITY DEFINER to bypass RLS
    - Caches result for performance
  
  ### 2. Update Admin Policy
    - Use the helper function instead of subquery
    - No recursion since function bypasses RLS
  
  ## Security Notes
  - Function is SECURITY DEFINER but only returns boolean
  - Safe because it only checks the calling user's own role
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles v2" ON profiles;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Add admin access policy using the function
CREATE POLICY "Admins can view all profiles v3"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
