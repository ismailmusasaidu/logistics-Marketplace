/*
  # Fix Adverts RLS Policies for Admin Access

  1. Changes
    - Add policy for admins to view ALL adverts (both active and inactive)
    - This allows admins to manage adverts in the dashboard
    
  2. Security
    - Admins can view all adverts regardless of active status
    - Public users can still only view active adverts
*/

-- Drop existing select policy to recreate it properly
DROP POLICY IF EXISTS "Anyone can view active adverts" ON adverts;

-- Public users can view active adverts only
CREATE POLICY "Public can view active adverts"
  ON adverts
  FOR SELECT
  TO anon
  USING (
    is_active = true 
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
  );

-- Authenticated non-admin users can view active adverts
CREATE POLICY "Authenticated users can view active adverts"
  ON adverts
  FOR SELECT
  TO authenticated
  USING (
    (
      is_active = true 
      AND (start_date IS NULL OR start_date <= now())
      AND (end_date IS NULL OR end_date >= now())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
