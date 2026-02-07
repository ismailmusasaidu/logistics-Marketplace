/*
  # Create service_requests table

  1. New Tables
    - `service_requests`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to profiles)
      - `full_name` (text) - customer's full name
      - `phone` (text) - customer's phone number
      - `pickup_area` (text) - pickup location area
      - `dropoff_area` (text) - dropoff location area
      - `service_type` (text) - gadget_delivery or relocation
      - `status` (text) - pending, contacted, confirmed, completed, cancelled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on service_requests table
    - Customers can create their own requests
    - Customers can view their own requests
    - Admins can view and manage all requests
*/

CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  pickup_area text NOT NULL,
  dropoff_area text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('gadget_delivery', 'relocation')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create own service requests"
  ON service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view own service requests"
  ON service_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update service requests"
  ON service_requests
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

CREATE POLICY "Admins can delete service requests"
  ON service_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_service_requests_customer_id ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
