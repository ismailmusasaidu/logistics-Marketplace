/*
  # Create Order Size Pricing Table

  1. New Tables
    - `order_size_pricing`
      - `id` (uuid, primary key)
      - `size` (text) - 'medium' or 'large' (small is always free)
      - `label` (text) - display label e.g. "Medium Package"
      - `description` (text, nullable) - optional description
      - `additional_fee` (numeric) - extra charge added to base delivery fee
      - `is_active` (boolean) - whether this size surcharge is active
      - `display_order` (integer) - ordering for UI display
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can read active records
    - Admins can manage all records (using is_admin function)

  3. Initial Data
    - Medium: ₦500 surcharge
    - Large: ₦1,000 surcharge
*/

CREATE TABLE IF NOT EXISTS order_size_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size text NOT NULL,
  label text NOT NULL DEFAULT '',
  description text,
  additional_fee numeric NOT NULL DEFAULT 0 CHECK (additional_fee >= 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_size_pricing_size_check CHECK (size IN ('medium', 'large')),
  CONSTRAINT order_size_pricing_size_unique UNIQUE (size)
);

ALTER TABLE order_size_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order size pricing"
  ON order_size_pricing
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert order size pricing"
  ON order_size_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update order size pricing"
  ON order_size_pricing
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete order size pricing"
  ON order_size_pricing
  FOR DELETE
  TO authenticated
  USING (is_admin());

INSERT INTO order_size_pricing (size, label, description, additional_fee, is_active, display_order)
VALUES
  ('medium', 'Medium Package', 'Packages that require extra handling or are moderately sized', 500, true, 1),
  ('large', 'Large Package', 'Bulky or heavy packages requiring special care', 1000, true, 2)
ON CONFLICT (size) DO NOTHING;
