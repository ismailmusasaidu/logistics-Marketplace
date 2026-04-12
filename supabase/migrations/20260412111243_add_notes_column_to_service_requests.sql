/*
  # Add notes column to service_requests

  ## Change
  - Add optional `notes` text column to `service_requests` table for admin annotations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_requests' AND column_name = 'notes'
  ) THEN
    ALTER TABLE service_requests ADD COLUMN notes text;
  END IF;
END $$;
