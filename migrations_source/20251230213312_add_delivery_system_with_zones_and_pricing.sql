-- Delivery System with Zones, Pricing, Promotions, and Logs
--
-- Overview:
-- Comprehensive delivery management system allowing automatic distance calculation,
-- zone-based pricing, promotions, manual adjustments, and complete audit logging.
--
-- New Tables:
-- 1. delivery_zones - Admin-managed geographical zones with pricing rules
-- 2. delivery_pricing - Global delivery pricing configuration
-- 3. delivery_addresses - Customer delivery addresses with coordinates
-- 4. promotions - Delivery promotions and discount codes
-- 5. delivery_adjustments - Manual price adjustments by admin
-- 6. delivery_logs - Audit trail for all delivery calculations
--
-- Security:
-- - Enable RLS on all tables
-- - Customers can view/manage their own addresses
-- - Admins can manage zones, pricing, promotions, adjustments
-- - All users can view active promotions

-- Create delivery_zones table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  radius_km decimal(10, 2) NOT NULL,
  base_price decimal(10, 2) NOT NULL DEFAULT 0,
  price_per_km decimal(10, 2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create delivery_pricing table (single row configuration)
CREATE TABLE IF NOT EXISTS delivery_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_base_price decimal(10, 2) NOT NULL DEFAULT 0,
  default_price_per_km decimal(10, 2) NOT NULL DEFAULT 0,
  min_delivery_charge decimal(10, 2) NOT NULL DEFAULT 0,
  max_delivery_distance_km decimal(10, 2) DEFAULT 50,
  free_delivery_threshold decimal(10, 2) DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Insert default pricing configuration
INSERT INTO delivery_pricing (default_base_price, default_price_per_km, min_delivery_charge, max_delivery_distance_km, free_delivery_threshold)
VALUES (5.00, 2.00, 3.00, 50.00, 100.00)
ON CONFLICT (id) DO NOTHING;

-- Create delivery_addresses table
CREATE TABLE IF NOT EXISTS delivery_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  is_default boolean DEFAULT false,
  zone_id uuid REFERENCES delivery_zones(id) ON DELETE SET NULL,
  distance_from_store_km decimal(10, 2),
  estimated_delivery_price decimal(10, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_delivery')),
  discount_value decimal(10, 2) NOT NULL,
  min_order_amount decimal(10, 2) DEFAULT 0,
  max_discount_amount decimal(10, 2),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  usage_limit integer,
  usage_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create delivery_adjustments table
CREATE TABLE IF NOT EXISTS delivery_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  original_price decimal(10, 2) NOT NULL,
  adjusted_price decimal(10, 2) NOT NULL,
  adjustment_amount decimal(10, 2) NOT NULL,
  reason text NOT NULL,
  adjusted_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create delivery_logs table
CREATE TABLE IF NOT EXISTS delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  order_id uuid REFERENCES orders(id),
  address_id uuid REFERENCES delivery_addresses(id),
  action text NOT NULL,
  details jsonb,
  zone_id uuid REFERENCES delivery_zones(id),
  distance_km decimal(10, 2),
  base_price decimal(10, 2),
  distance_price decimal(10, 2),
  promotion_discount decimal(10, 2) DEFAULT 0,
  adjustment_amount decimal(10, 2) DEFAULT 0,
  final_price decimal(10, 2),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_zones
CREATE POLICY "Anyone can view active zones"
  ON delivery_zones FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage zones"
  ON delivery_zones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for delivery_pricing
CREATE POLICY "Anyone can view pricing"
  ON delivery_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update pricing"
  ON delivery_pricing FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for delivery_addresses
CREATE POLICY "Users can view own addresses"
  ON delivery_addresses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own addresses"
  ON delivery_addresses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own addresses"
  ON delivery_addresses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own addresses"
  ON delivery_addresses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all addresses"
  ON delivery_addresses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for promotions
CREATE POLICY "Anyone can view active promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND valid_from <= now()
    AND valid_until >= now()
  );

CREATE POLICY "Admins can view all promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage promotions"
  ON promotions FOR ALL
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

-- Policies for delivery_adjustments
CREATE POLICY "Admins can view all adjustments"
  ON delivery_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create adjustments"
  ON delivery_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for delivery_logs
CREATE POLICY "Users can view own logs"
  ON delivery_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all logs"
  ON delivery_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Anyone authenticated can insert logs"
  ON delivery_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON delivery_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_zone_id ON delivery_addresses(zone_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_user_id ON delivery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_order_id ON delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_adjustments_order_id ON delivery_adjustments(order_id);