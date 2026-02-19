/*
  # Create Logistics Adverts Table

  ## Summary
  Creates a dedicated adverts/promotions/announcements table for the logistics module,
  separate from the marketplace adverts system.

  ## New Tables
  - `logistics_adverts`
    - `id` (uuid, primary key)
    - `title` (text) - headline text shown on the banner/modal
    - `description` (text) - supporting copy
    - `image_url` (text, nullable) - optional hero image
    - `badge_text` (text) - short badge label e.g. "HOT DEAL", "NEW", "PROMO"
    - `badge_type` (text) - colour theme: 'hot_deal' | 'featured' | 'trending' | 'limited'
    - `action_text` (text, nullable) - CTA button label e.g. "Book Now"
    - `action_url` (text, nullable) - optional deep-link or external URL
    - `display_mode` (text) - 'banner' shows in the slider; 'modal' shows as a popup; 'both'
    - `display_frequency` (text) - 'once' | 'daily' | 'always'
    - `priority` (integer) - higher = shown first
    - `is_active` (boolean)
    - `start_date` (timestamptz, nullable)
    - `end_date` (timestamptz, nullable)
    - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Admins can do all CRUD
  - Authenticated users (customers/riders) can read active adverts only
*/

CREATE TABLE IF NOT EXISTS logistics_adverts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  badge_text text NOT NULL DEFAULT 'NEW',
  badge_type text NOT NULL DEFAULT 'featured' CHECK (badge_type IN ('hot_deal', 'featured', 'trending', 'limited')),
  action_text text,
  action_url text,
  display_mode text NOT NULL DEFAULT 'both' CHECK (display_mode IN ('banner', 'modal', 'both')),
  display_frequency text NOT NULL DEFAULT 'always' CHECK (display_frequency IN ('once', 'daily', 'always')),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logistics_adverts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select logistics adverts"
  ON logistics_adverts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert logistics adverts"
  ON logistics_adverts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update logistics adverts"
  ON logistics_adverts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete logistics adverts"
  ON logistics_adverts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read active logistics adverts"
  ON logistics_adverts FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
  );

CREATE OR REPLACE FUNCTION update_logistics_adverts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER logistics_adverts_updated_at
  BEFORE UPDATE ON logistics_adverts
  FOR EACH ROW EXECUTE FUNCTION update_logistics_adverts_updated_at();
