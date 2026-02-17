/*
  # Create Logistics Ratings Table

  ## Summary
  Creates the `ratings` table used by the logistics app so customers can
  rate riders after a delivered order.

  ## New Tables
  - `ratings`
    - `id` (uuid, primary key)
    - `order_id` (uuid, FK to orders)
    - `rider_id` (uuid, FK to riders)
    - `customer_id` (uuid, FK to profiles)
    - `rating` (integer 1-5)
    - `comment` (text, nullable)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated customers can insert their own ratings
  - Authenticated users can read ratings (riders, admins, customers)
  - One rating per order enforced via unique constraint
*/

CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (order_id)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can insert own ratings"
  ON ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Authenticated users can view ratings"
  ON ratings
  FOR SELECT
  TO authenticated
  USING (true);
