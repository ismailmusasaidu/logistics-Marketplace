-- ============================================================================
-- CONSOLIDATED MARKETPLACE MIGRATION
-- ============================================================================
-- This is a single consolidated migration combining all 66 original marketplace
-- migrations into one idempotent script.
--
-- ASSUMES CORE_BACKEND has already created:
--   - profiles table (id, email, full_name, phone, role, avatar_url, created_at, updated_at)
--   - wallets table
--   - wallet_transactions table
--   - Auth user trigger for profile creation
--
-- This migration creates all marketplace-specific tables, RLS policies,
-- functions, triggers, and storage buckets.
-- ============================================================================


-- ============================================================================
-- SECTION 0: HELPER FUNCTIONS (needed by RLS policies)
-- ============================================================================

-- is_admin() - Security definer function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ============================================================================
-- SECTION 1: ALTER PROFILES TABLE (add marketplace-specific columns)
-- ============================================================================

DO $$
BEGIN
  -- Vendor approval columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vendor_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vendor_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_description'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_license'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_license text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason text;
  END IF;

  -- Suspension columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_suspended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_by uuid;
  END IF;
END $$;

-- Vendor status check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_vendor_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_vendor_status_check
  CHECK (vendor_status IN ('pending', 'approved', 'rejected'));

-- Index for suspension lookups
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_by
ON profiles(suspended_by)
WHERE suspended_by IS NOT NULL;

-- Grant necessary permissions for FK constraint checks
GRANT SELECT ON profiles TO authenticated;


-- ============================================================================
-- SECTION 2: ENUM TYPES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'cancelled'
    );
  END IF;
END $$;


-- ============================================================================
-- SECTION 3: CREATE CORE TABLES
-- ============================================================================

-- ---------- CATEGORIES ----------
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;


-- ---------- VENDORS ----------
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  business_name text NOT NULL,
  description text,
  logo_url text,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  rating numeric DEFAULT 0,
  total_sales integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;


-- ---------- PRODUCTS ----------
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL CHECK (price >= 0),
  unit text DEFAULT 'piece',
  stock_quantity integer DEFAULT 0,
  is_available boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  discount_percentage integer DEFAULT 0,
  discount_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);


-- ---------- PRODUCT IMAGES ----------
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order ON product_images(display_order);


-- ---------- CARTS ----------
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);


-- ---------- ORDERS ----------
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  order_number text UNIQUE NOT NULL,
  status order_status DEFAULT 'pending',
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  delivery_address text,
  delivery_type text NOT NULL DEFAULT 'pickup' CHECK (delivery_type IN ('pickup', 'delivery')),
  payment_method text DEFAULT 'cash_on_delivery',
  payment_status text DEFAULT 'pending',
  notes text,
  confirmed_at timestamptz,
  preparing_at timestamptz,
  ready_for_pickup_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('transfer', 'online', 'wallet', 'cash_on_delivery'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_user_id ON orders(vendor_user_id);


-- ---------- ORDER ITEMS ----------
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);


-- ---------- REVIEWS ----------
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  verified_purchase boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_user_product_unique'
  ) THEN
    ALTER TABLE reviews
    ADD CONSTRAINT reviews_user_product_unique
    UNIQUE (user_id, product_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);


-- ---------- VENDOR RESPONSES (to reviews) ----------
CREATE TABLE IF NOT EXISTS vendor_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vendor_responses_review_id ON vendor_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_vendor_responses_vendor_id ON vendor_responses(vendor_id);


-- ---------- REVIEW HELPFULNESS ----------
CREATE TABLE IF NOT EXISTS review_helpfulness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE review_helpfulness ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review_id ON review_helpfulness(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpfulness_user_id ON review_helpfulness(user_id);


-- ---------- VENDOR SETTINGS ----------
CREATE TABLE IF NOT EXISTS vendor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE UNIQUE NOT NULL,
  store_hours jsonb DEFAULT '{}'::jsonb,
  delivery_radius numeric DEFAULT 10,
  minimum_order numeric DEFAULT 0,
  accepts_online_payment boolean DEFAULT false,
  accepts_cash_on_delivery boolean DEFAULT true,
  store_banner_url text,
  social_media jsonb DEFAULT '{}'::jsonb,
  is_setup_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vendor_settings_vendor_id ON vendor_settings(vendor_id);


-- ---------- WISHLISTS ----------
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS wishlists_product_id_idx ON wishlists(product_id);


-- ---------- ADVERTS ----------
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
  hot_deal_text text DEFAULT 'HOT DEAL',
  featured_text text DEFAULT 'Featured',
  trending_text text DEFAULT 'Trending Now',
  limited_offer_text text DEFAULT 'Limited Time Offer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE adverts ENABLE ROW LEVEL SECURITY;


-- ---------- CONTENT PAGES ----------
CREATE TABLE IF NOT EXISTS content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text UNIQUE NOT NULL CHECK (page_type IN ('help_center', 'terms_of_service', 'privacy_policy')),
  title text NOT NULL,
  content jsonb NOT NULL,
  last_updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;


-- ---------- BANK ACCOUNTS ----------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;


-- ---------- VIRTUAL ACCOUNTS ----------
CREATE TABLE IF NOT EXISTS virtual_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  provider text DEFAULT 'paystack',
  provider_reference text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_virtual_accounts_user_id ON virtual_accounts(user_id);


-- ============================================================================
-- SECTION 4: DELIVERY SYSTEM TABLES
-- ============================================================================

-- ---------- DELIVERY ZONES (distance-based) ----------
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  min_distance_km decimal(10, 2) NOT NULL DEFAULT 0,
  max_distance_km decimal(10, 2) NOT NULL DEFAULT 0,
  price decimal(10, 2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;


-- ---------- DELIVERY PRICING (global config) ----------
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

ALTER TABLE delivery_pricing ENABLE ROW LEVEL SECURITY;

INSERT INTO delivery_pricing (default_base_price, default_price_per_km, min_delivery_charge, max_delivery_distance_km, free_delivery_threshold)
SELECT 5.00, 2.00, 3.00, 50.00, 100.00
WHERE NOT EXISTS (SELECT 1 FROM delivery_pricing);


-- ---------- DELIVERY ADDRESSES ----------
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

ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON delivery_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_zone_id ON delivery_addresses(zone_id);


-- ---------- PROMOTIONS ----------
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

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, valid_from, valid_until);


-- ---------- DELIVERY ADJUSTMENTS ----------
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

ALTER TABLE delivery_adjustments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_adjustments_order_id ON delivery_adjustments(order_id);


-- ---------- DELIVERY LOGS ----------
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

ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_logs_user_id ON delivery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_order_id ON delivery_logs(order_id);


-- ============================================================================
-- SECTION 5: RLS POLICIES - PROFILES (marketplace-specific additions)
-- ============================================================================

-- Admin view all profiles (using security definer function to avoid recursion)
DROP POLICY IF EXISTS "Admins can view all profiles v3" ON profiles;
CREATE POLICY "Admins can view all profiles v3"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Users can view vendor and admin profiles (for store display, admin dashboard)
DROP POLICY IF EXISTS "Users can view vendor and admin profiles" ON profiles;
CREATE POLICY "Users can view vendor and admin profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (role IN ('vendor', 'admin'));

-- Admin full update access
DROP POLICY IF EXISTS "Admins have full update access" ON profiles;
CREATE POLICY "Admins have full update access"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Users can update own basic profile (non-privileged fields only)
DROP POLICY IF EXISTS "Users can update own basic profile" ON profiles;
CREATE POLICY "Users can update own basic profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND COALESCE(is_suspended, false) = COALESCE((SELECT is_suspended FROM profiles WHERE id = auth.uid()), false)
    AND suspended_at IS NOT DISTINCT FROM (SELECT suspended_at FROM profiles WHERE id = auth.uid())
    AND suspended_by IS NOT DISTINCT FROM (SELECT suspended_by FROM profiles WHERE id = auth.uid())
  );

-- Admin delete users
DROP POLICY IF EXISTS "Admins can delete users" ON profiles;
DROP POLICY IF EXISTS "Admins can delete any user" ON profiles;
CREATE POLICY "Admins can delete users"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 6: RLS POLICIES - CATEGORIES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 7: RLS POLICIES - VENDORS
-- ============================================================================

DROP POLICY IF EXISTS "All authenticated users can view vendors" ON vendors;
CREATE POLICY "All authenticated users can view vendors"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Approved vendors can create own vendor profile" ON vendors;
CREATE POLICY "Approved vendors can create own vendor profile"
  ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
      AND profiles.vendor_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Vendors can update own vendor profile" ON vendors;
CREATE POLICY "Vendors can update own vendor profile"
  ON vendors
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all vendors" ON vendors;
CREATE POLICY "Admins can manage all vendors"
  ON vendors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 8: RLS POLICIES - PRODUCTS
-- ============================================================================

DROP POLICY IF EXISTS "Vendors can view own products" ON products;
CREATE POLICY "Vendors can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
    )
  );

DROP POLICY IF EXISTS "Vendors can insert own products" ON products;
CREATE POLICY "Vendors can insert own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
      AND profiles.vendor_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Vendors can update own products" ON products;
CREATE POLICY "Vendors can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
    )
  );

DROP POLICY IF EXISTS "Vendors can delete own products" ON products;
CREATE POLICY "Vendors can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'vendor'
    )
  );

DROP POLICY IF EXISTS "Customers can view available products" ON products;
CREATE POLICY "Customers can view available products"
  ON products FOR SELECT
  TO authenticated
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'customer'
    )
  );

DROP POLICY IF EXISTS "Admins can view all products" ON products;
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert products" ON products;
CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete products" ON products;
CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 9: RLS POLICIES - PRODUCT IMAGES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view product images" ON product_images;
CREATE POLICY "Anyone can view product images"
  ON product_images
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Vendors can insert their product images" ON product_images;
CREATE POLICY "Vendors can insert their product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update their product images" ON product_images;
CREATE POLICY "Vendors can update their product images"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can delete their product images" ON product_images;
CREATE POLICY "Vendors can delete their product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.vendor_id = auth.uid()
    )
  );


-- ============================================================================
-- SECTION 10: RLS POLICIES - CARTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own cart" ON carts;
CREATE POLICY "Users can view own cart"
  ON carts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own cart items" ON carts;
CREATE POLICY "Users can insert own cart items"
  ON carts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own cart items" ON carts;
CREATE POLICY "Users can update own cart items"
  ON carts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own cart items" ON carts;
CREATE POLICY "Users can delete own cart items"
  ON carts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- SECTION 11: RLS POLICIES - ORDERS
-- ============================================================================

DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert orders" ON orders;
CREATE POLICY "Customers can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can view own orders" ON orders;
CREATE POLICY "Vendors can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can update own orders" ON orders;
CREATE POLICY "Vendors can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can delete own orders" ON orders;
CREATE POLICY "Vendors can delete own orders"
  ON orders FOR DELETE
  TO authenticated
  USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete all orders" ON orders;
CREATE POLICY "Admins can delete all orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 12: RLS POLICIES - ORDER ITEMS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id
      FROM orders
      WHERE customer_id = auth.uid()
         OR vendor_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert order items" ON order_items;
CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 13: RLS POLICIES - REVIEWS
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendors can delete reviews on own products" ON reviews;
CREATE POLICY "Vendors can delete reviews on own products"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    product_id IN (
      SELECT p.id
      FROM products p
      WHERE p.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete any review" ON reviews;
CREATE POLICY "Admins can delete any review"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 14: RLS POLICIES - VENDOR RESPONSES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read vendor responses" ON vendor_responses;
CREATE POLICY "Anyone can read vendor responses"
  ON vendor_responses FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Vendors can create responses to their product reviews" ON vendor_responses;
CREATE POLICY "Vendors can create responses to their product reviews"
  ON vendor_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = vendor_id
    AND EXISTS (
      SELECT 1 FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.id = review_id
      AND p.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update own responses" ON vendor_responses;
CREATE POLICY "Vendors can update own responses"
  ON vendor_responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can delete own responses" ON vendor_responses;
CREATE POLICY "Vendors can delete own responses"
  ON vendor_responses FOR DELETE
  TO authenticated
  USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Admins can delete any vendor response" ON vendor_responses;
CREATE POLICY "Admins can delete any vendor response"
  ON vendor_responses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 15: RLS POLICIES - REVIEW HELPFULNESS
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read review helpfulness" ON review_helpfulness;
CREATE POLICY "Anyone can read review helpfulness"
  ON review_helpfulness FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can vote on review helpfulness" ON review_helpfulness;
CREATE POLICY "Users can vote on review helpfulness"
  ON review_helpfulness FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own helpfulness votes" ON review_helpfulness;
CREATE POLICY "Users can update own helpfulness votes"
  ON review_helpfulness FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own helpfulness votes" ON review_helpfulness;
CREATE POLICY "Users can delete own helpfulness votes"
  ON review_helpfulness FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- SECTION 16: RLS POLICIES - VENDOR SETTINGS
-- ============================================================================

DROP POLICY IF EXISTS "Vendors can view own settings" ON vendor_settings;
CREATE POLICY "Vendors can view own settings"
  ON vendor_settings FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can insert own settings" ON vendor_settings;
CREATE POLICY "Vendors can insert own settings"
  ON vendor_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update own settings" ON vendor_settings;
CREATE POLICY "Vendors can update own settings"
  ON vendor_settings FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can view approved vendor settings" ON vendor_settings;
CREATE POLICY "Customers can view approved vendor settings"
  ON vendor_settings FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE is_verified = true AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage vendor settings" ON vendor_settings;
CREATE POLICY "Admins can manage vendor settings"
  ON vendor_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 17: RLS POLICIES - WISHLISTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own wishlist items" ON wishlists;
CREATE POLICY "Users can view their own wishlist items"
  ON wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add items to their own wishlist" ON wishlists;
CREATE POLICY "Users can add items to their own wishlist"
  ON wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove items from their own wishlist" ON wishlists;
CREATE POLICY "Users can remove items from their own wishlist"
  ON wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- SECTION 18: RLS POLICIES - ADVERTS
-- ============================================================================

DROP POLICY IF EXISTS "Public can view active adverts" ON adverts;
CREATE POLICY "Public can view active adverts"
  ON adverts FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
  );

DROP POLICY IF EXISTS "Authenticated users can view active adverts" ON adverts;
CREATE POLICY "Authenticated users can view active adverts"
  ON adverts FOR SELECT
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

DROP POLICY IF EXISTS "Admins can insert adverts" ON adverts;
CREATE POLICY "Admins can insert adverts"
  ON adverts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update adverts" ON adverts;
CREATE POLICY "Admins can update adverts"
  ON adverts FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete adverts" ON adverts;
CREATE POLICY "Admins can delete adverts"
  ON adverts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 19: RLS POLICIES - CONTENT PAGES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read content pages" ON content_pages;
CREATE POLICY "Anyone can read content pages"
  ON content_pages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert content pages" ON content_pages;
CREATE POLICY "Admins can insert content pages"
  ON content_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update content pages" ON content_pages;
CREATE POLICY "Admins can update content pages"
  ON content_pages FOR UPDATE
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


-- ============================================================================
-- SECTION 20: RLS POLICIES - BANK ACCOUNTS
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active bank accounts" ON bank_accounts;
CREATE POLICY "Anyone can view active bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage bank accounts" ON bank_accounts;
CREATE POLICY "Admins can manage bank accounts"
  ON bank_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 21: RLS POLICIES - VIRTUAL ACCOUNTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own virtual accounts" ON virtual_accounts;
CREATE POLICY "Users can view own virtual accounts"
  ON virtual_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own virtual accounts" ON virtual_accounts;
CREATE POLICY "Users can insert own virtual accounts"
  ON virtual_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all virtual accounts" ON virtual_accounts;
CREATE POLICY "Admins can view all virtual accounts"
  ON virtual_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- SECTION 22: RLS POLICIES - DELIVERY SYSTEM
-- ============================================================================

-- Delivery Zones
DROP POLICY IF EXISTS "Anyone can view active zones" ON delivery_zones;
CREATE POLICY "Anyone can view active zones"
  ON delivery_zones FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage zones" ON delivery_zones;
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

-- Delivery Pricing
DROP POLICY IF EXISTS "Anyone can view pricing" ON delivery_pricing;
CREATE POLICY "Anyone can view pricing"
  ON delivery_pricing FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update pricing" ON delivery_pricing;
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

-- Delivery Addresses
DROP POLICY IF EXISTS "Users can view own addresses" ON delivery_addresses;
CREATE POLICY "Users can view own addresses"
  ON delivery_addresses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own addresses" ON delivery_addresses;
CREATE POLICY "Users can insert own addresses"
  ON delivery_addresses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own addresses" ON delivery_addresses;
CREATE POLICY "Users can update own addresses"
  ON delivery_addresses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own addresses" ON delivery_addresses;
CREATE POLICY "Users can delete own addresses"
  ON delivery_addresses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all addresses" ON delivery_addresses;
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

-- Promotions
DROP POLICY IF EXISTS "Anyone can view active promotions" ON promotions;
CREATE POLICY "Anyone can view active promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND valid_from <= now()
    AND valid_until >= now()
  );

DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;
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

DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
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

-- Delivery Adjustments
DROP POLICY IF EXISTS "Admins can view all adjustments" ON delivery_adjustments;
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

DROP POLICY IF EXISTS "Admins can create adjustments" ON delivery_adjustments;
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

-- Delivery Logs
DROP POLICY IF EXISTS "Users can view own logs" ON delivery_logs;
CREATE POLICY "Users can view own logs"
  ON delivery_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all logs" ON delivery_logs;
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

DROP POLICY IF EXISTS "Anyone authenticated can insert logs" ON delivery_logs;
CREATE POLICY "Anyone authenticated can insert logs"
  ON delivery_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ============================================================================
-- SECTION 23: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- ---------- is_vendor_viewing_customer helper ----------
CREATE OR REPLACE FUNCTION public.is_vendor_viewing_customer(profile_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.customer_id = profile_id
    AND orders.vendor_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Vendor customer visibility policy (depends on the function above)
DROP POLICY IF EXISTS "Vendors can view their order customers" ON profiles;
CREATE POLICY "Vendors can view their order customers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_vendor_viewing_customer(id));

-- ---------- Vendor User ID Sync Trigger ----------
CREATE OR REPLACE FUNCTION sync_vendor_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.vendor_user_id := NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_vendor_user_id ON orders;
CREATE TRIGGER trigger_sync_vendor_user_id
  BEFORE INSERT OR UPDATE OF vendor_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_vendor_user_id();


-- ---------- Order Status Timestamps Trigger ----------
CREATE OR REPLACE FUNCTION update_order_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        NEW.confirmed_at = now();
      WHEN 'preparing' THEN
        NEW.preparing_at = now();
      WHEN 'ready_for_pickup' THEN
        NEW.ready_for_pickup_at = now();
      WHEN 'out_for_delivery' THEN
        NEW.out_for_delivery_at = now();
      WHEN 'delivered' THEN
        NEW.delivered_at = now();
      WHEN 'cancelled' THEN
        NEW.cancelled_at = now();
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_order_status_timestamp ON orders;
CREATE TRIGGER set_order_status_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_timestamp();


-- ---------- Product Rating Auto-Update Trigger ----------
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE products
    SET
      rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = OLD.product_id), 0),
      total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = OLD.product_id)
    WHERE id = OLD.product_id;
    RETURN OLD;
  ELSE
    UPDATE products
    SET
      rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = NEW.product_id), 0),
      total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rating_after_review_insert ON reviews;
CREATE TRIGGER update_rating_after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

DROP TRIGGER IF EXISTS update_rating_after_review_update ON reviews;
CREATE TRIGGER update_rating_after_review_update
AFTER UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

DROP TRIGGER IF EXISTS update_rating_after_review_delete ON reviews;
CREATE TRIGGER update_rating_after_review_delete
AFTER DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();


-- ---------- Vendor Rating Calculation ----------
CREATE OR REPLACE FUNCTION calculate_vendor_rating(vendor_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  avg_rating NUMERIC;
BEGIN
  SELECT AVG(rating)
  INTO avg_rating
  FROM products
  WHERE vendor_id = vendor_user_id
    AND rating > 0
    AND total_reviews > 0;

  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_vendor_rating_on_product_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vendors
  SET rating = calculate_vendor_rating(NEW.vendor_id),
      updated_at = now()
  WHERE user_id = NEW.vendor_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_vendor_rating ON products;
CREATE TRIGGER trigger_update_vendor_rating
  AFTER INSERT OR UPDATE OF rating, total_reviews
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_rating_on_product_change();


-- ---------- Content Pages updated_at Trigger ----------
CREATE OR REPLACE FUNCTION update_content_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_content_pages_updated_at ON content_pages;
CREATE TRIGGER set_content_pages_updated_at
  BEFORE UPDATE ON content_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_content_pages_updated_at();


-- ---------- Adverts updated_at Trigger ----------
CREATE OR REPLACE FUNCTION update_adverts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS adverts_updated_at ON adverts;
CREATE TRIGGER adverts_updated_at
  BEFORE UPDATE ON adverts
  FOR EACH ROW
  EXECUTE FUNCTION update_adverts_updated_at();


-- ---------- Vendor Responses updated_at Trigger ----------
CREATE OR REPLACE FUNCTION update_vendor_response_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_vendor_responses_updated_at ON vendor_responses;
CREATE TRIGGER trigger_vendor_responses_updated_at
  BEFORE UPDATE ON vendor_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_response_updated_at();


-- ============================================================================
-- SECTION 24: SEED DATA - CONTENT PAGES
-- ============================================================================

INSERT INTO content_pages (page_type, title, content) VALUES
(
  'help_center',
  'Help Center',
  '{
    "sections": [
      {
        "title": "Frequently Asked Questions",
        "items": [
          {
            "question": "How do I place an order?",
            "answer": "Browse products on the home screen, tap on a product to view details, select quantity, and add to cart. Then go to the cart tab and proceed to checkout."
          },
          {
            "question": "How do I track my order?",
            "answer": "Go to the Orders tab to view all your orders. Tap on any order to see detailed tracking information and current status."
          },
          {
            "question": "What payment methods are accepted?",
            "answer": "We accept all major credit cards, debit cards, and digital payment methods. Payment is processed securely through our payment gateway."
          },
          {
            "question": "How do I become a vendor?",
            "answer": "Register as a vendor during sign up or contact admin support. Once approved, you can set up your store and start listing products."
          }
        ]
      },
      {
        "title": "Contact Support",
        "items": [
          {
            "type": "email",
            "label": "Email Support",
            "value": "support@marketplace.com"
          },
          {
            "type": "phone",
            "label": "Phone Support",
            "value": "+1 (555) 123-4567"
          },
          {
            "type": "chat",
            "label": "Live Chat",
            "value": "Available 9 AM - 6 PM EST"
          }
        ]
      }
    ]
  }'::jsonb
),
(
  'terms_of_service',
  'Terms of Service',
  '{
    "lastUpdated": "November 30, 2025",
    "sections": [
      {
        "heading": "1. Acceptance of Terms",
        "content": "By accessing and using this marketplace platform, you accept and agree to be bound by the terms and provision of this agreement."
      },
      {
        "heading": "2. Use License",
        "content": "Permission is granted to temporarily access the materials on the marketplace platform for personal, non-commercial transitory viewing only."
      },
      {
        "heading": "3. User Accounts",
        "content": "When you create an account with us, you must provide accurate, complete, and current information."
      }
    ]
  }'::jsonb
),
(
  'privacy_policy',
  'Privacy Policy',
  '{
    "lastUpdated": "November 30, 2025",
    "sections": [
      {
        "heading": "1. Introduction",
        "content": "This Privacy Policy describes how we collect, use, and handle your personal information when you use our marketplace platform."
      },
      {
        "heading": "2. Information We Collect",
        "content": "When you create an account, we collect personal information including full name, email address, phone number, delivery address, and payment information."
      },
      {
        "heading": "3. How We Use Your Information",
        "content": "We use the collected information to provide and maintain our service, process transactions, and improve user experience."
      }
    ]
  }'::jsonb
)
ON CONFLICT (page_type) DO NOTHING;


-- ============================================================================
-- SECTION 25: STORAGE BUCKETS AND POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-banners', 'vendor-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Product Images Storage Policies
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  );

DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  )
  WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  );

DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  );

-- Vendor Banners Storage Policies
DROP POLICY IF EXISTS "Vendors can upload own banners" ON storage.objects;
CREATE POLICY "Vendors can upload own banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-banners' AND
    auth.uid() IN (
      SELECT user_id FROM vendors WHERE id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Vendors can update own banners" ON storage.objects;
CREATE POLICY "Vendors can update own banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-banners' AND
    auth.uid() IN (
      SELECT user_id FROM vendors WHERE id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Vendors can delete own banners" ON storage.objects;
CREATE POLICY "Vendors can delete own banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-banners' AND
    auth.uid() IN (
      SELECT user_id FROM vendors WHERE id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Anyone can view vendor banners" ON storage.objects;
CREATE POLICY "Anyone can view vendor banners"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vendor-banners');


-- ============================================================================
-- SECTION 26: REALTIME PUBLICATIONS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'carts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE carts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'wishlists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wishlists;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vendor_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendor_responses;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'review_helpfulness'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE review_helpfulness;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vendor_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendor_settings;
  END IF;
END $$;


-- ============================================================================
-- SECTION 27: FOREIGN KEY ADJUSTMENTS FOR CASCADING DELETES
-- ============================================================================

-- orders.customer_id -> SET NULL on delete (preserve order history when user deleted)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- orders.vendor_user_id -> SET NULL on delete
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_vendor_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_vendor_user_id_fkey
  FOREIGN KEY (vendor_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- order_items.product_id -> SET NULL on delete (preserve order history when product deleted)
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- reviews.order_id -> SET NULL on delete
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_order_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- carts.user_id -> CASCADE on delete
ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_user_id_fkey;
ALTER TABLE carts ADD CONSTRAINT carts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- reviews.user_id -> CASCADE on delete
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- products.vendor_id -> CASCADE on delete
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_vendor_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES profiles(id) ON DELETE CASCADE;