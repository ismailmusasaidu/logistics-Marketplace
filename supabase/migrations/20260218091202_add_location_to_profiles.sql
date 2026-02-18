/*
  # Add location fields to profiles

  Adds optional location columns to the profiles table so customers can
  store their last known GPS coordinates and a human-readable address.

  1. New columns on `profiles`
    - `location_lat`     (float8) – latitude
    - `location_lng`     (float8) – longitude
    - `location_address` (text)   – reverse-geocoded display address
    - `location_updated_at` (timestamptz) – when location was last saved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_lat float8;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_lng float8;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_updated_at timestamptz;
  END IF;
END $$;
