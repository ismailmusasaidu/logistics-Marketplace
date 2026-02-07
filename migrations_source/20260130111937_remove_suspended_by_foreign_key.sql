/*
  # Remove suspended_by Foreign Key Constraint

  1. Problem
    - Foreign key constraint on suspended_by conflicts with RLS policies
    - Admin suspend/unsuspend operations fail with 500 error
    - FK validation cannot properly check references under RLS

  2. Solution
    - Remove the foreign key constraint
    - Keep suspended_by as a plain UUID field
    - Application logic will ensure referential integrity

  3. Security
    - Maintains all RLS policies
    - Admin can suspend/unsuspend users
    - Data integrity handled at application level
*/

-- Drop the foreign key constraint causing RLS conflicts
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_suspended_by_fkey;

-- Keep the index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_by
ON profiles(suspended_by)
WHERE suspended_by IS NOT NULL;
