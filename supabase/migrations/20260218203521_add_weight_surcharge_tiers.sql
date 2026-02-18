/*
  # Add Weight Surcharge Tiers for Marketplace Cart

  ## Summary
  Creates a table that allows admins to define additional charges based on
  the total weight (kg) of items in a customer's cart. Each tier defines a
  weight range and the extra fee charged when cart weight falls within that range.

  ## New Tables

  ### weight_surcharge_tiers
  - `id` (uuid, primary key)
  - `min_weight_kg` (numeric) - Minimum total cart weight for this tier to apply (inclusive)
  - `max_weight_kg` (numeric, nullable) - Maximum cart weight for this tier (exclusive). NULL = no upper limit
  - `charge_amount` (numeric) - Additional fee in Naira to add to cart total
  - `label` (text) - Human-readable name for this tier (e.g. "Heavy order surcharge")
  - `is_active` (boolean) - Whether this tier is currently applied
  - `display_order` (integer) - Controls sort order in admin UI
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT (needed for cart calculation)
  - Only admins can INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS weight_surcharge_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_weight_kg numeric(10, 3) NOT NULL DEFAULT 0,
  max_weight_kg numeric(10, 3),
  charge_amount numeric(12, 2) NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weight_surcharge_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weight surcharge tiers"
  ON weight_surcharge_tiers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert weight surcharge tiers"
  ON weight_surcharge_tiers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update weight surcharge tiers"
  ON weight_surcharge_tiers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete weight surcharge tiers"
  ON weight_surcharge_tiers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_weight_surcharge_tiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weight_surcharge_tiers_updated_at
  BEFORE UPDATE ON weight_surcharge_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_weight_surcharge_tiers_updated_at();
