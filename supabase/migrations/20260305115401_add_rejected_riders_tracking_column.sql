/*
  # Add Rejected Riders Tracking to Orders

  1. Changes
    - Add `rejected_rider_ids` column (uuid[]) to orders table
      Stores the list of all rider IDs who have rejected or timed out on this order
      so the reassign function can exclude them all, not just the most recent one

  2. Notes
    - Defaults to empty array
    - No RLS changes needed — already protected by existing order policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rejected_rider_ids'
  ) THEN
    ALTER TABLE orders ADD COLUMN rejected_rider_ids uuid[] DEFAULT '{}';
  END IF;
END $$;
