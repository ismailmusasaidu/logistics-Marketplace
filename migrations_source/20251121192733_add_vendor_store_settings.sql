/*
  # Add Vendor Store Settings

  1. New Tables
    - `vendor_settings` - Store configuration for vendors
      - `id` (uuid, primary key)
      - `vendor_id` (uuid, foreign key to vendors)
      - `store_hours` (jsonb) - Opening/closing hours
      - `delivery_radius` (numeric) - Maximum delivery distance in km
      - `minimum_order` (numeric) - Minimum order amount
      - `accepts_online_payment` (boolean)
      - `accepts_cash_on_delivery` (boolean)
      - `store_banner_url` (text)
      - `social_media` (jsonb) - Social media links
      - `is_setup_complete` (boolean) - Whether store setup is finished
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `vendor_settings` table
    - Add policy for vendors to view their own settings
    - Add policy for vendors to update their own settings
    - Add policy for customers to view approved vendor settings
*/

CREATE TABLE IF NOT EXISTS vendor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE UNIQUE NOT NULL,
  store_hours jsonb DEFAULT '{}'::jsonb,
  delivery_radius numeric DEFAULT 10,
  minimum_order numeric DEFAULT 0,
  accepts_online_payment boolean DEFAULT false,
  accepts_cash_on_delivery boolean DEFAULT true,
  store_banner_url text,
  social_media jsonb DEFAULT '{}'::jsonb,
  is_setup_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own settings"
  ON vendor_settings
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert own settings"
  ON vendor_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update own settings"
  ON vendor_settings
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view approved vendor settings"
  ON vendor_settings
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE is_verified = true AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_vendor_settings_vendor_id ON vendor_settings(vendor_id);
