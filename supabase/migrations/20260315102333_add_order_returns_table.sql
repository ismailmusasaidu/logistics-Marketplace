/*
  # Add Order Returns & Exchanges Table

  ## Summary
  Creates the `order_returns` table to support return and exchange requests initiated by customers.

  ## New Tables
  - `order_returns`
    - `id` (uuid, primary key)
    - `order_id` (uuid, references orders)
    - `customer_id` (uuid, references profiles)
    - `item_ids` (text[], optional list of specific order_item ids)
    - `reason` (text) - customer-provided reason
    - `return_type` (text) - 'refund' or 'exchange'
    - `status` (text) - pending | approved | rejected | completed
    - `admin_notes` (text) - internal admin notes
    - `refund_amount` (numeric) - amount to refund if approved
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Customers can only see and create their own returns
  - Admins can view and update all returns
*/

CREATE TABLE IF NOT EXISTS order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_ids text[] DEFAULT '{}',
  reason text NOT NULL,
  return_type text NOT NULL DEFAULT 'refund' CHECK (return_type IN ('refund', 'exchange')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes text,
  refund_amount numeric(12, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own returns"
  ON order_returns FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert own returns"
  ON order_returns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Admins can view all returns"
  ON order_returns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all returns"
  ON order_returns FOR UPDATE
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

CREATE OR REPLACE FUNCTION update_order_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_returns_updated_at
  BEFORE UPDATE ON order_returns
  FOR EACH ROW EXECUTE FUNCTION update_order_returns_updated_at();

CREATE INDEX IF NOT EXISTS idx_order_returns_customer_id ON order_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_order_id ON order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_status ON order_returns(status);
