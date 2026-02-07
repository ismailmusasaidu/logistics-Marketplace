/*
  # Add Vendor Approval System

  1. Changes to profiles table
    - Add `vendor_status` column (pending, approved, rejected)
    - Add `business_name` column for vendor business name
    - Add `business_description` column for vendor business description
    - Add `business_address` column for vendor business address
    - Add `business_phone` column for vendor business phone
    - Add `business_license` column for vendor business license number
    - Add `rejection_reason` column for admin feedback

  2. Security
    - Add check constraint for vendor_status values
    - Vendors can only access dashboard if status is 'approved'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vendor_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vendor_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_description'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_license'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_license text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason text;
  END IF;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_vendor_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_vendor_status_check 
  CHECK (vendor_status IN ('pending', 'approved', 'rejected'));

UPDATE profiles SET vendor_status = 'approved' WHERE role IN ('customer', 'admin');