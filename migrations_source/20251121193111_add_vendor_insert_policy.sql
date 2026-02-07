/*
  # Add Vendor Insert Policy

  1. Changes
    - Add policy to allow approved vendors to create their vendor record
  
  2. Security
    - Only users with role='vendor' and vendor_status='approved' can insert
    - They can only insert a record for themselves (user_id = auth.uid())
*/

CREATE POLICY "Approved vendors can create own vendor profile"
  ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'vendor' 
      AND profiles.vendor_status = 'approved'
    )
  );
