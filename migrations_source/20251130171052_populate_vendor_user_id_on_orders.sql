/*
  # Automatically Populate vendor_user_id on Orders

  1. Changes
    - Create trigger function to automatically set vendor_user_id when order is created
    - Backfill existing orders with vendor_user_id from vendors table
    - Add trigger to populate vendor_user_id on new orders

  2. How It Works
    - When an order is inserted with vendor_id, automatically look up the vendor's user_id from vendors table
    - Set vendor_user_id to match the vendor's profile id
    - This enables RLS policy for vendors to see their customers' profiles

  3. Security
    - No RLS changes, just data population
    - Maintains existing security model
*/

-- Create function to populate vendor_user_id
CREATE OR REPLACE FUNCTION populate_vendor_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the user_id (profile id) from the vendors table
  SELECT user_id INTO NEW.vendor_user_id
  FROM vendors
  WHERE id = NEW.vendor_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run before insert on orders
DROP TRIGGER IF EXISTS trigger_populate_vendor_user_id ON orders;
CREATE TRIGGER trigger_populate_vendor_user_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION populate_vendor_user_id();

-- Backfill existing orders with vendor_user_id
UPDATE orders
SET vendor_user_id = vendors.user_id
FROM vendors
WHERE orders.vendor_id = vendors.id
AND orders.vendor_user_id IS NULL;
