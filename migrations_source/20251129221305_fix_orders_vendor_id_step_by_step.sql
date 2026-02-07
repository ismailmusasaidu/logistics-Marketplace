/*
  # Fix Orders Vendor ID - Step by Step

  1. Data Migration
    - Drop old foreign key constraint first
    - Update existing orders to use profile.id instead of vendors.id
    - Add new foreign key constraint that references profiles.id

  2. Security
    - Maintains data integrity by updating all existing orders
    - Ensures vendor_id always references valid profiles
*/

-- Step 1: Drop the old foreign key constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_vendor_id_fkey;

-- Step 2: Update existing orders to use profile.id instead of vendors.id
UPDATE orders o
SET vendor_id = v.user_id
FROM vendors v
WHERE o.vendor_id = v.id;

-- Step 3: Add new foreign key constraint referencing profiles
ALTER TABLE orders
ADD CONSTRAINT orders_vendor_id_fkey 
FOREIGN KEY (vendor_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;
