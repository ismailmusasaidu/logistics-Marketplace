/*
  # Create logistics tables for rider management and zone assignment

  1. New Tables
    - `riders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `vehicle_type` (text: bike, motorcycle, car, van)
      - `vehicle_number` (text)
      - `license_number` (text)
      - `status` (text: offline, online)
      - `rating` (decimal)
      - `total_deliveries` (integer)
      - `current_lat` (decimal)
      - `current_lng` (decimal)
      - `zone_id` (uuid, references zones)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `zones`
      - `id` (uuid, primary key)
      - `name` (text) - Zone name
      - `description` (text) - Optional description
      - `is_active` (boolean) - Whether zone is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for admins to manage zones and riders
    - Add policies for riders to view zones and their own info

  3. Important Notes
    - Riders table references profiles table
    - Zone assignments are optional
    - Status is now 'online' and 'offline' only
*/

-- ============================================
-- ZONES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RIDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('bike', 'motorcycle', 'car', 'van')),
  vehicle_number text NOT NULL,
  license_number text NOT NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online')),
  rating decimal(3,2) DEFAULT 5.0,
  total_deliveries integer DEFAULT 0,
  current_lat decimal(10,8),
  current_lng decimal(11,8),
  zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_zone_id ON riders(zone_id);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);

-- ============================================
-- RLS POLICIES FOR ZONES
-- ============================================

-- Admins can view all zones
CREATE POLICY "Admins can view all zones"
  ON zones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can insert zones
CREATE POLICY "Admins can insert zones"
  ON zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update zones
CREATE POLICY "Admins can update zones"
  ON zones FOR UPDATE
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

-- Admins can delete zones
CREATE POLICY "Admins can delete zones"
  ON zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Riders can view all zones
CREATE POLICY "Riders can view all zones"
  ON zones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'rider'
    )
  );

-- Customers can view active zones
CREATE POLICY "Customers can view active zones"
  ON zones FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
    )
  );

-- ============================================
-- RLS POLICIES FOR RIDERS
-- ============================================

-- Riders can view their own profile
CREATE POLICY "Riders can view own profile"
  ON riders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Riders can update their own profile
CREATE POLICY "Riders can update own profile"
  ON riders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all riders
CREATE POLICY "Admins can view all riders"
  ON riders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can insert riders
CREATE POLICY "Admins can insert riders"
  ON riders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update riders
CREATE POLICY "Admins can update riders"
  ON riders FOR UPDATE
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

-- Allow rider signups
CREATE POLICY "Riders can insert own profile during signup"
  ON riders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'rider'
    )
  );