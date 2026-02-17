/*
  # Add missing columns to bank_accounts table

  ## Changes
  - `bank_accounts` table: add `account_type`, `swift_code`, `branch`, `guidelines` columns
    that the admin UI expects but are missing from the current schema.

  ## Notes
  - All new columns are optional (nullable) to avoid breaking existing rows
  - `account_type` defaults to 'Checking' for backwards compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN account_type text NOT NULL DEFAULT 'Checking';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'swift_code'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN swift_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'branch'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN branch text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'guidelines'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN guidelines text;
  END IF;
END $$;
