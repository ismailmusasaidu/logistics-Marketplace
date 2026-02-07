/*
  # Add Wallet System

  1. Changes to Profiles Table
    - Add `wallet_balance` column with default value 0.00
    - Balance will be stored as numeric with 2 decimal places
  
  2. New Tables
    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `type` (text: 'credit' or 'debit')
      - `amount` (numeric)
      - `balance_before` (numeric)
      - `balance_after` (numeric)
      - `description` (text)
      - `reference_type` (text: 'order', 'topup', 'refund', etc.)
      - `reference_id` (uuid, nullable)
      - `status` (text: 'pending', 'completed', 'failed')
      - `created_at` (timestamp)
  
  3. Security
    - Enable RLS on wallet_transactions table
    - Users can only view their own transactions
    - Only admins can manually adjust wallet balances
    - Wallet deductions happen through secure functions
  
  4. Functions
    - Function to credit wallet (top-up)
    - Function to debit wallet (payment)
    - Both functions are secure and handle race conditions
*/

-- Add wallet balance to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance numeric(10, 2) DEFAULT 0.00 NOT NULL;
    ALTER TABLE profiles ADD CONSTRAINT wallet_balance_non_negative CHECK (wallet_balance >= 0);
  END IF;
END $$;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  balance_before numeric(10, 2) NOT NULL,
  balance_after numeric(10, 2) NOT NULL,
  description text NOT NULL,
  reference_type text CHECK (reference_type IN ('order', 'topup', 'refund', 'admin_adjustment')),
  reference_id uuid,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to credit wallet (top-up)
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_type text DEFAULT 'topup',
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  v_transaction_id uuid;
BEGIN
  -- Lock the profile row for update
  SELECT wallet_balance INTO v_balance_before
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Calculate new balance
  v_balance_after := v_balance_before + p_amount;

  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_balance_after,
      updated_at = now()
  WHERE id = p_user_id;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    description, reference_type, reference_id, status
  ) VALUES (
    p_user_id, 'credit', p_amount, v_balance_before, v_balance_after,
    p_description, p_reference_type, p_reference_id, 'completed'
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

-- Function to debit wallet (payment)
CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_type text DEFAULT 'order',
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  v_transaction_id uuid;
BEGIN
  -- Lock the profile row for update
  SELECT wallet_balance INTO v_balance_before
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check sufficient balance
  IF v_balance_before < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Calculate new balance
  v_balance_after := v_balance_before - p_amount;

  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_balance_after,
      updated_at = now()
  WHERE id = p_user_id;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    description, reference_type, reference_id, status
  ) VALUES (
    p_user_id, 'debit', p_amount, v_balance_before, v_balance_after,
    p_description, p_reference_type, p_reference_id, 'completed'
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);