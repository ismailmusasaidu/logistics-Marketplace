/*
  # Add recipient and package info fields to orders table

  ## Summary
  The logistics order receipt needs to display recipient contact info and package details,
  but these columns were missing from the orders table.

  ## New Columns
  - `recipient_name` (text) - Name of the person receiving the package
  - `recipient_phone` (text) - Phone number of the recipient
  - `package_description` (text) - Description of the package contents
  - `order_types` (text[]) - Array of package type tags (e.g. Groceries, Medicine, Express Delivery)

  These fields are already referenced in the customer-request-service form and the
  OrderReceiptModal component but were absent from the schema.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'recipient_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN recipient_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'recipient_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN recipient_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'package_description'
  ) THEN
    ALTER TABLE orders ADD COLUMN package_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_types'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_types text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'scheduled_delivery_time'
  ) THEN
    ALTER TABLE orders ADD COLUMN scheduled_delivery_time timestamptz;
  END IF;
END $$;
