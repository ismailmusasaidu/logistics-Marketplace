/*
  # Fix Order Deletion Constraint
  
  ## Overview
  This migration fixes the foreign key constraint on the reviews table to allow
  orders to be deleted by admins even if they have associated reviews.
  
  ## Changes
  - Drop the existing foreign key constraint on reviews.order_id
  - Recreate it with ON DELETE SET NULL instead of NO ACTION
  - This allows orders to be deleted while preserving the review history
*/

-- Drop the existing constraint
ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_order_id_fkey;

-- Recreate with SET NULL on delete
ALTER TABLE reviews
ADD CONSTRAINT reviews_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES orders(id)
ON DELETE SET NULL;
