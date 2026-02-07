/*
  # Add Wallet Withdrawal Support

  1. Changes
    - Update wallet_transactions reference_type constraint to include 'withdrawal'
    - This allows users to withdraw funds from their wallet
  
  2. Security
    - Withdrawals use the existing debit_wallet function
    - All RLS policies remain unchanged
    - Users can only withdraw their own funds
*/

-- Drop the existing constraint
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_reference_type_check;

-- Add updated constraint with 'withdrawal' included
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_reference_type_check 
  CHECK (reference_type IN ('order', 'topup', 'refund', 'admin_adjustment', 'withdrawal'));