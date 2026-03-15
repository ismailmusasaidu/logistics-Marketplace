/*
  # Add period_from and period_to to vendor_payouts

  1. Changes
    - Adds `period_from` (date, nullable) — start date of the payout period
    - Adds `period_to` (date, nullable) — end date of the payout period

  2. Notes
    - Both columns are optional to preserve backward compatibility with existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_payouts' AND column_name = 'period_from'
  ) THEN
    ALTER TABLE vendor_payouts ADD COLUMN period_from date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_payouts' AND column_name = 'period_to'
  ) THEN
    ALTER TABLE vendor_payouts ADD COLUMN period_to date;
  END IF;
END $$;
