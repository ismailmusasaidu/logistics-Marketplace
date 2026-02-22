/*
  # Fix is_admin() to check profiles table with SECURITY DEFINER

  1. Problem
    - Admin user's auth.users metadata has role='customer' but profiles table has role='admin'
    - The is_admin() function was changed to check auth.users metadata which doesn't match
  
  2. Solution
    - Use SECURITY DEFINER to bypass RLS when checking profiles table
    - This avoids infinite recursion because SECURITY DEFINER runs as the function owner (postgres)
      which bypasses RLS entirely
    - Also sync the admin user's auth metadata to match their profile role

  3. Changes
    - Recreate is_admin() as SECURITY DEFINER querying profiles (bypasses RLS)
    - Sync existing admin users' auth metadata
*/

-- Step 1: Recreate is_admin() to query profiles with SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Step 2: Recreate is_admin(uuid) similarly
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT role = 'admin' FROM public.profiles WHERE id = user_id),
    false
  );
$$;

-- Step 3: Sync admin users' auth metadata to match their profile roles
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE auth.users.id = p.id
AND p.role = 'admin'
AND (auth.users.raw_user_meta_data->>'role' IS NULL OR auth.users.raw_user_meta_data->>'role' != 'admin');
