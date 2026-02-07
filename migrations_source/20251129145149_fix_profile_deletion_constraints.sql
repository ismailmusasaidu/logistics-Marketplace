/*
  # Fix Profile Deletion Constraints

  1. Changes
    - Change orders foreign keys to SET NULL on delete
    - Change profiles.suspended_by to SET NULL on delete
    - This allows admins to delete users even if they have orders or suspended others
  
  2. Security
    - Maintains data integrity
    - Preserves order history even after user deletion
    - Clears suspension tracking when suspending admin is deleted
*/

-- Drop and recreate orders.customer_id foreign key with SET NULL
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE orders 
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Drop and recreate orders.vendor_user_id foreign key with SET NULL
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_vendor_user_id_fkey;

ALTER TABLE orders 
  ADD CONSTRAINT orders_vendor_user_id_fkey 
  FOREIGN KEY (vendor_user_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Drop and recreate profiles.suspended_by foreign key with SET NULL
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_suspended_by_fkey;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_suspended_by_fkey 
  FOREIGN KEY (suspended_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;