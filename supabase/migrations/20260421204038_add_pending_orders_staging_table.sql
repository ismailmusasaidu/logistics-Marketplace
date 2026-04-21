/*
  # Add pending_orders staging table

  ## Purpose
  Creates a durable bridge between "Paystack payment initialized" and "order created".
  When a user is redirected to Paystack to pay, all order details are saved here first.
  The Paystack webhook then reads this table to automatically create the real order
  without requiring the user to manually return and tap "Verify Payment".

  ## New Tables
  - `pending_orders`
    - `id` (uuid, PK)
    - `paystack_reference` (text, UNIQUE) - the Paystack transaction reference
    - `source` (text) - 'logistics' or 'marketplace'
    - `customer_id` (uuid, FK → auth.users) - the paying customer
    - `order_data` (jsonb) - full snapshot of all fields needed to create the real order
    - `status` (text) - 'pending', 'completed', or 'expired'
    - `created_at` (timestamptz)
    - `expires_at` (timestamptz) - 2 hours TTL; stale rows can be ignored

  ## Security
  - RLS enabled
  - Customers can INSERT their own rows
  - Customers can SELECT their own rows (for polling)
  - Only service role (webhook) can UPDATE status to 'completed'
  - No DELETE allowed from client side

  ## Notes
  - `order_data` for logistics contains: pickup/delivery addresses, recipient info, pricing, etc.
  - `order_data` for marketplace contains: cart items (grouped by vendor), delivery info, promo, totals
  - The webhook distinguishes source via the `source` column
*/

CREATE TABLE IF NOT EXISTS pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_reference text UNIQUE NOT NULL,
  source text NOT NULL CHECK (source IN ('logistics', 'marketplace')),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '2 hours'
);

CREATE INDEX IF NOT EXISTS pending_orders_reference_idx ON pending_orders (paystack_reference);
CREATE INDEX IF NOT EXISTS pending_orders_customer_idx ON pending_orders (customer_id);
CREATE INDEX IF NOT EXISTS pending_orders_status_idx ON pending_orders (status);

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can insert own pending orders"
  ON pending_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view own pending orders"
  ON pending_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);
