/*
  # Fix Wallet Reference ID to Text
  
  1. Changes
    - Modify `wallet_transactions.reference_id` from uuid to text
    - This allows storing external payment references (Paystack, bank transfers, etc.)
    - External payment gateways return string references, not UUIDs
  
  2. Update Function
    - Update `credit_wallet` function to accept text reference_id
    - Update `debit_wallet` function to accept text reference_id (if exists)
*/

-- Drop existing credit_wallet function
DROP FUNCTION IF EXISTS credit_wallet(uuid, numeric, text, text, uuid);

-- Alter the reference_id column type
ALTER TABLE wallet_transactions 
  ALTER COLUMN reference_id TYPE text;

-- Recreate credit_wallet function with text reference_id
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_type text DEFAULT 'topup',
  p_reference_id text DEFAULT NULL
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Recreate debit_wallet function if it exists (check first)
DROP FUNCTION IF EXISTS debit_wallet(uuid, numeric, text, text, text);

CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_type text DEFAULT 'order',
  p_reference_id text DEFAULT NULL
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

  -- Check if user has sufficient balance
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;