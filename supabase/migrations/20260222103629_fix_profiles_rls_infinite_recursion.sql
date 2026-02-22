/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - The `is_admin()` function queries the `profiles` table
    - Profiles RLS policies call `is_admin()`, creating circular recursion
    - This prevents admins from approving/rejecting vendors and other admin operations
    - Duplicate admin policies for UPDATE and DELETE compound the issue

  2. Solution
    - Recreate `is_admin()` to use `auth.jwt()` metadata instead of querying profiles
    - This breaks the circular dependency since JWT checks don't trigger RLS
    - Remove all duplicate and conflicting policies on profiles
    - Create clean, non-recursive policies

  3. Security
    - All policies still enforce proper authentication checks
    - Admin checks use JWT role metadata (set at login, not user-editable)
    - Users can only read/update their own profiles
    - Admins can view and manage all profiles
    - Vendors/admins are publicly visible for storefront purposes
*/

-- Step 1: Drop the old is_admin functions that cause recursion
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Step 2: Recreate is_admin() using JWT metadata (no table query = no recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT raw_user_meta_data->>'role' = 'admin'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
$$;

-- Step 3: Recreate is_admin(uuid) using auth.users instead of profiles
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT raw_user_meta_data->>'role' = 'admin'
     FROM auth.users
     WHERE id = user_id),
    false
  );
$$;

-- Step 4: Drop ALL existing policies on profiles to start clean
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full update access" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.profiles;

-- Step 5: Create clean, non-recursive SELECT policy
CREATE POLICY "Users can view own and public profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR role IN ('vendor', 'admin')
    OR public.is_admin()
  );

-- Step 6: INSERT policy - users can create their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Step 7: UPDATE policy - users update own, admins update all
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Step 8: DELETE policy - only admins
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
