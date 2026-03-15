/*
  # Add updated_at column to rider_payouts

  1. Changes
    - Adds `updated_at` timestamptz column to `rider_payouts` table with default now()
    - This column is written by the RiderPayouts component when status changes are made

  2. Notes
    - Uses IF NOT EXISTS check to be safe on re-runs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rider_payouts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE rider_payouts ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
