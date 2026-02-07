/*
  # Fix vendor_user_id to Match vendor_id

  1. Problem
    - orders.vendor_id already references profiles.id (the vendor's user account)
    - orders.vendor_user_id should be the same as vendor_id for RLS policies to work
    - Previous migration assumed vendor_id referenced vendors.id, but it references profiles.id

  2. Changes
    - Drop old trigger and function
    - Create new trigger to sync vendor_user_id with vendor_id
    - Backfill existing orders where vendor_user_id is null

  3. Security
    - Enables "Vendors can view their order customers" RLS policy to work correctly
    - No security model changes, just data consistency fix
*/

-- Drop old trigger and function
DROP TRIGGER IF EXISTS trigger_populate_vendor_user_id ON orders;
DROP FUNCTION IF EXISTS populate_vendor_user_id();

-- Create new function to sync vendor_user_id with vendor_id
CREATE OR REPLACE FUNCTION sync_vendor_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- vendor_id already points to profiles.id, so just copy it
  NEW.vendor_user_id := NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert or update on orders
CREATE TRIGGER trigger_sync_vendor_user_id
  BEFORE INSERT OR UPDATE OF vendor_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_vendor_user_id();

-- Backfill existing orders: set vendor_user_id = vendor_id
UPDATE orders
SET vendor_user_id = vendor_id
WHERE vendor_user_id IS NULL OR vendor_user_id != vendor_id;
