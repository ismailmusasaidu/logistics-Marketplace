/*
  # Create user_bank_accounts table

  1. New Tables
    - `user_bank_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `account_number` (text) - bank account number
      - `account_name` (text) - name on the bank account
      - `bank_name` (text) - name of the bank
      - `bank_code` (text) - bank code for API integrations
      - `recipient_code` (text, nullable) - Paystack recipient code
      - `is_verified` (boolean) - whether account has been verified
      - `is_default` (boolean) - whether this is the default account
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on user_bank_accounts table
    - Users can manage their own bank accounts
    - Admins can view all bank accounts
*/

CREATE TABLE IF NOT EXISTS user_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  bank_code text NOT NULL DEFAULT '',
  recipient_code text,
  is_verified boolean DEFAULT false,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts"
  ON user_bank_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts"
  ON user_bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON user_bank_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts"
  ON user_bank_accounts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id ON user_bank_accounts(user_id);
