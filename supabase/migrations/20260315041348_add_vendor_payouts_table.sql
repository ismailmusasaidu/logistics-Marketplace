/*
  # Add Vendor Payouts Table

  ## Overview
  Creates a vendor_payouts table for admins to track and manage payout requests from vendors.

  ## New Tables
  - `vendor_payouts`
    - `id` (uuid, primary key)
    - `vendor_id` (uuid) – references vendors.id
    - `vendor_user_id` (uuid) – references profiles.id (the vendor's user account)
    - `amount` (numeric) – the requested payout amount
    - `status` (text) – pending | approved | processing | completed | rejected
    - `bank_account_id` (uuid, nullable) – references user_bank_accounts.id
    - `bank_name` (text) – snapshot of bank name at time of request
    - `account_number` (text) – snapshot of account number at time of request
    - `account_name` (text) – snapshot of account name at time of request
    - `note` (text, nullable) – vendor's note/reason for request
    - `admin_note` (text, nullable) – admin's internal note
    - `processed_by` (uuid, nullable) – admin profile id who processed it
    - `processed_at` (timestamptz, nullable)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Admins can do everything
  - Vendors can insert and read their own payouts
*/

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  bank_account_id uuid REFERENCES user_bank_accounts(id) ON DELETE SET NULL,
  bank_name text,
  account_number text,
  account_name text,
  note text,
  admin_note text,
  processed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all vendor payouts"
  ON vendor_payouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert vendor payouts"
  ON vendor_payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update vendor payouts"
  ON vendor_payouts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete vendor payouts"
  ON vendor_payouts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Vendors can view own payouts"
  ON vendor_payouts
  FOR SELECT
  TO authenticated
  USING (vendor_user_id = auth.uid());

CREATE POLICY "Vendors can create own payout requests"
  ON vendor_payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (vendor_user_id = auth.uid());
