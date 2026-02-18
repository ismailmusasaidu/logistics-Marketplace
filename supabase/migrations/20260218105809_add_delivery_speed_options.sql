/*
  # Add Delivery Speed Options

  ## Summary
  Adds a new `delivery_speed_options` table to allow admins to configure
  Express and Standard delivery tiers with additional cost surcharges.
  Also adds `delivery_speed` and `delivery_speed_cost` columns to orders.

  ## New Tables
  - `delivery_speed_options`
    - `id` (uuid, primary key)
    - `name` (text) — e.g. "Standard", "Express"
    - `label` (text) — short display label
    - `description` (text) — customer-facing description
    - `additional_cost` (numeric) — flat fee added on top of zone delivery fee
    - `estimated_time` (text) — e.g. "2–4 hours", "30–60 minutes"
    - `is_active` (boolean) — admin can enable/disable each option
    - `display_order` (int) — controls render order
    - `created_at`, `updated_at` (timestamptz)

  ## Modified Tables
  - `orders` — added `delivery_speed` (text) and `delivery_speed_cost` (numeric)

  ## Security
  - RLS enabled with policies for authenticated reads and admin writes
  - Uses is_admin() function (no arguments, checks auth.uid() internally)

  ## Seed Data
  - Standard delivery (₦0 extra, 2–4 hours)
  - Express delivery (₦500 extra, 30–60 minutes)
*/

CREATE TABLE IF NOT EXISTS delivery_speed_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  additional_cost numeric NOT NULL DEFAULT 0,
  estimated_time text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_speed_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active speed options"
  ON delivery_speed_options FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert speed options"
  ON delivery_speed_options FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update speed options"
  ON delivery_speed_options FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete speed options"
  ON delivery_speed_options FOR DELETE
  TO authenticated
  USING (is_admin());

INSERT INTO delivery_speed_options (name, label, description, additional_cost, estimated_time, is_active, display_order)
VALUES
  ('Standard', 'Standard', 'Regular delivery at standard pace', 0, '2–4 hours', true, 1),
  ('Express', 'Express', 'Priority handling and faster delivery', 500, '30–60 minutes', true, 2)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_speed'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_speed text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_speed_cost'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_speed_cost numeric DEFAULT 0;
  END IF;
END $$;
