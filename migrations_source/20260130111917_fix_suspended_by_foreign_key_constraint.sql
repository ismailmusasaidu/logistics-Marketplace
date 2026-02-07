/*
  # Fix suspended_by Foreign Key Constraint

  1. Problem
    - Foreign key constraint on suspended_by is failing during RLS checks
    - When admin suspends a user, the FK validation cannot see the admin profile

  2. Solution
    - Drop the existing foreign key constraint
    - Add it back with NO INHERIT to bypass RLS for FK checks
    - Alternatively, use a function-based check constraint

  3. Security
    - Maintains referential integrity
    - Allows FK checks to work with RLS policies
*/

-- Drop the existing foreign key constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_suspended_by_fkey;

-- Add it back with deferred checking to allow RLS policies to work
ALTER TABLE profiles
ADD CONSTRAINT profiles_suspended_by_fkey
FOREIGN KEY (suspended_by)
REFERENCES profiles(id)
ON DELETE SET NULL
DEFERRABLE INITIALLY DEFERRED;

-- Create an index to improve FK check performance
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_by
ON profiles(suspended_by)
WHERE suspended_by IS NOT NULL;
