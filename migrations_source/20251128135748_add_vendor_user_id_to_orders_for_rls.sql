/*
  # Add vendor_user_id to Orders Table for RLS

  ## Overview
  To avoid infinite recursion in RLS policies, we add a denormalized vendor_user_id
  column to the orders table. This allows policies to check vendor ownership without
  joining the vendors table.

  ## Changes Made
  
  ### 1. New Column
    - `vendor_user_id` (uuid) - The user_id of the vendor who owns this order
    - References profiles table
    - Indexed for performance
  
  ### 2. Backfill Data
    - Populate vendor_user_id for all existing orders
  
  ### 3. Trigger
    - Auto-populate vendor_user_id when new orders are created
  
  ### 4. Update Profiles Policy
    - Rewrite the vendor customer visibility policy to use vendor_user_id directly
    - No more circular dependencies
  
  ## Security Notes
  - Vendors can only see customers who ordered from them
  - No circular policy references
  - Improved query performance
*/

-- Add vendor_user_id column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS vendor_user_id uuid REFERENCES profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_vendor_user_id ON orders(vendor_user_id);

-- Backfill vendor_user_id for existing orders
UPDATE orders o
SET vendor_user_id = v.user_id
FROM vendors v
WHERE o.vendor_id = v.id AND o.vendor_user_id IS NULL;

-- Create function to auto-populate vendor_user_id
CREATE OR REPLACE FUNCTION set_order_vendor_user_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT user_id INTO NEW.vendor_user_id
  FROM vendors
  WHERE id = NEW.vendor_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-populate on insert/update
DROP TRIGGER IF EXISTS set_order_vendor_user_id_trigger ON orders;
CREATE TRIGGER set_order_vendor_user_id_trigger
  BEFORE INSERT OR UPDATE OF vendor_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_vendor_user_id();

-- Drop old policy
DROP POLICY IF EXISTS "Vendors can view customers who ordered from them" ON profiles;

-- Create new policy without circular reference
CREATE POLICY "Vendors can view customers who ordered from them"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'customer'
    AND EXISTS (
      SELECT 1
      FROM orders
      WHERE customer_id = profiles.id
        AND vendor_user_id = auth.uid()
    )
  );
