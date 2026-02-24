/*
  # Create order_type_adjustments table

  ## Summary
  Creates the order_type_adjustments table used by the pricing calculator
  to apply additional charges based on the type of order selected by customers
  (e.g., fragile items, express handling, etc.)

  ## New Tables
  - `order_type_adjustments`
    - `id` (uuid, primary key)
    - `adjustment_name` (text, unique) - display name shown to customer, used for pricing lookup
    - `description` (text, nullable) - optional admin description
    - `adjustment_type` ('flat' | 'percentage') - how the charge is applied
    - `adjustment_value` (numeric) - flat amount in ₦ or percentage value
    - `is_active` (boolean) - controls whether this adjustment is applied
    - `created_at` / `updated_at` (timestamps)

  ## Security
  - RLS enabled
  - Admins can do all CRUD operations
  - Authenticated users can read (required for pricing calculator)
*/

CREATE TABLE IF NOT EXISTS order_type_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_name text UNIQUE NOT NULL,
  description text,
  adjustment_type text NOT NULL DEFAULT 'flat' CHECK (adjustment_type IN ('flat', 'percentage')),
  adjustment_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_type_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order type adjustments"
  ON order_type_adjustments
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read order type adjustments"
  ON order_type_adjustments
  FOR SELECT
  TO authenticated
  USING (true);
