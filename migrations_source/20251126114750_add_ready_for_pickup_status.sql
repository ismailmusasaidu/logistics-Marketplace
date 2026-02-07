/*
  # Add Ready for Pickup Status

  1. Changes
    - Add 'ready_for_pickup' value to the order_status enum type
    - This new status will be positioned between 'preparing' and 'out_for_delivery' in the order workflow
  
  2. Purpose
    - Allow vendors to mark orders as ready for customer pickup
    - Provides better order tracking for pickup orders
*/

-- Add the new status to the enum type
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_pickup' AFTER 'preparing';
