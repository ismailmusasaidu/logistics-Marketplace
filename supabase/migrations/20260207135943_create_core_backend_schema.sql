/*
  # CORE_BACKEND - Centralized Auth, Users & Wallet Schema

  This migration creates the shared backend that serves both
  the Logistics App (APP A) and the Marketplace App (APP B).

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `phone` (text)
      - `role` (text, default 'customer')
      - `avatar_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `wallets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, unique, references auth.users)
      - `balance` (numeric, default 0)
      - `locked_balance` (numeric, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `type` (text: credit/debit)
      - `amount` (numeric)
      - `description` (text)
      - `reference` (text)
      - `reference_type` (text)
      - `source_app` (text: logistics/marketplace)
      - `balance_after` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Users can only read/update their own profile
    - Users can only read their own wallet
    - Users can only read their own transactions
    - Wallet mutations happen ONLY through SECURITY DEFINER functions

  3. Functions
    - `handle_new_user()` - auto-creates profile + wallet on signup
    - `auto_confirm_user_email()` - auto-confirms email on signup
    - `credit_wallet_balance()` - atomic credit operation
    - `debit_wallet_balance()` - atomic debit operation
    - `get_wallet_with_transactions()` - returns wallet + recent history

  4. Triggers
    - Auto-create profile and wallet on new user signup
    - Auto-confirm user emails
    - Auto-update updated_at timestamps
*/

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'customer',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================
-- WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked_balance numeric NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- WALLET TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL DEFAULT '',
  reference text,
  reference_type text,
  source_app text NOT NULL DEFAULT 'logistics' CHECK (source_app IN ('logistics', 'marketplace')),
  balance_after numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_source_app ON wallet_transactions(source_app);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- AUTO-CONFIRM EMAIL TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := NOW();
  NEW.confirmed_at := NOW();
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"email_verified": true}'::jsonb;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'confirm_user_email_trigger'
  ) THEN
    CREATE TRIGGER confirm_user_email_trigger
      BEFORE INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION auto_confirm_user_email();
  END IF;
END $$;

-- ============================================
-- AUTO-CREATE PROFILE + WALLET ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
  user_name text;
  user_phone text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (NEW.id, NEW.email, user_name, user_phone, user_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- WALLET OPERATION FUNCTIONS (SECURITY DEFINER)
-- ============================================

-- Credit wallet (atomic)
CREATE OR REPLACE FUNCTION credit_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT '',
  p_reference text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_source_app text DEFAULT 'logistics'
)
RETURNS jsonb AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_new_balance numeric;
  v_txn_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO wallets (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  v_new_balance := v_wallet.balance + p_amount;

  UPDATE wallets SET balance = v_new_balance WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions (user_id, type, amount, description, reference, reference_type, source_app, balance_after)
  VALUES (p_user_id, 'credit', p_amount, p_description, p_reference, p_reference_type, p_source_app, v_new_balance)
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Debit wallet (atomic)
CREATE OR REPLACE FUNCTION debit_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT '',
  p_reference text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_source_app text DEFAULT 'logistics'
)
RETURNS jsonb AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_new_balance numeric;
  v_txn_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'current_balance', v_wallet.balance);
  END IF;

  v_new_balance := v_wallet.balance - p_amount;

  UPDATE wallets SET balance = v_new_balance WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions (user_id, type, amount, description, reference, reference_type, source_app, balance_after)
  VALUES (p_user_id, 'debit', p_amount, p_description, p_reference, p_reference_type, p_source_app, v_new_balance)
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
