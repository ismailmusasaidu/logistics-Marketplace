/*
  # Add Payment Method to Orders

  1. Changes
    - Add `payment_method` column to orders table with check constraint
    - Allows: 'transfer', 'online', 'wallet', 'cash_on_delivery'
    - Add `payment_status` column to track payment completion
    - Allows: 'pending', 'completed', 'failed'
  
  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Sets default values for new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method text DEFAULT 'cash_on_delivery';
    ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check 
      CHECK (payment_method IN ('transfer', 'online', 'wallet', 'cash_on_delivery'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending';
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;