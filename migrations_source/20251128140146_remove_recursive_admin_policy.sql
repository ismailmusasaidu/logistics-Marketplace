/*
  # Remove Recursive Admin Policy

  ## Overview
  The "Admins can update vendor profiles" policy causes infinite recursion.
  We're removing it since the "Users can update own profile" policy already
  handles the main use case. Admin capabilities can be implemented via
  server-side functions if needed.

  ## Changes Made
  
  ### 1. Drop Problematic Policy
    - Remove "Admins can update vendor profiles" policy completely
  
  ### 2. Existing Policies Remain
    - "Users can update own profile" - Users can still update their own profiles
    - All SELECT policies remain unchanged
  
  ## Security Notes
  - Users can update their own profiles
  - Admin updates can be handled via edge functions with service role if needed
  - No circular policy references
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can update vendor profiles" ON profiles;
