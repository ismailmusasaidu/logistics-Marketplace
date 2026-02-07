/*
  # Create Adverts System

  1. New Tables
    - `adverts`
      - `id` (uuid, primary key)
      - `title` (text) - Advert title/heading
      - `description` (text) - Advert description/body
      - `image_url` (text, nullable) - URL to advert image
      - `action_text` (text, nullable) - Button text (e.g., "Shop Now")
      - `action_url` (text, nullable) - Link when user clicks button
      - `is_active` (boolean) - Whether advert is currently active
      - `start_date` (timestamptz, nullable) - When to start showing
      - `end_date` (timestamptz, nullable) - When to stop showing
      - `display_frequency` (text) - How often to show: 'once', 'daily', 'always'
      - `priority` (integer) - Higher priority shows first
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `adverts` table
    - Public can read active adverts
    - Only admins can create/update/delete adverts
*/

-- Create adverts table
CREATE TABLE IF NOT EXISTS adverts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  image_url text,
  action_text text,
  action_url text,
  is_active boolean DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  display_frequency text DEFAULT 'daily' CHECK (display_frequency IN ('once', 'daily', 'always')),
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE adverts ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active adverts
CREATE POLICY "Anyone can view active adverts"
  ON adverts
  FOR SELECT
  USING (
    is_active = true 
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
  );

-- Only admins can insert adverts
CREATE POLICY "Admins can insert adverts"
  ON adverts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update adverts
CREATE POLICY "Admins can update adverts"
  ON adverts
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

-- Only admins can delete adverts
CREATE POLICY "Admins can delete adverts"
  ON adverts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_adverts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adverts_updated_at
  BEFORE UPDATE ON adverts
  FOR EACH ROW
  EXECUTE FUNCTION update_adverts_updated_at();
