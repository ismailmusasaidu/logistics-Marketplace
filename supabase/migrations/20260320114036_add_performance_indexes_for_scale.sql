/*
  # Performance Indexes for 200k User Scale

  ## Summary
  Adds missing database indexes to support high-traffic queries across all major tables.
  These indexes are critical for the application to handle 200,000+ users without
  performance degradation.

  ## Tables Improved
  1. `orders` - Composite indexes for rider assignment, source+status filtering, customer history
  2. `profiles` - Role+created_at for admin listing, suspended users partial index
  3. `riders` - Zone+status for assignment queries, status+created_at for listing
  4. `ratings` (logistics) - Rider/customer/order lookup indexes
  5. `products` - Vendor+availability, category+availability, general availability feed
  6. `order_items` - Order+product composite, standalone product lookup
  7. `wallet_transactions` - User+created_at composite for transaction history
  8. `reviews` - Product/user lookup for review queries
  9. `carts` - User lookup for cart queries
  10. `service_requests` - Customer/status lookup
  11. `wishlists` - User+product lookup
  12. `vendor_payouts` - Vendor+created_at, status filtering
  13. `adverts` - Active adverts partial index

  ## Why These Indexes Matter
  Without indexes, PostgreSQL performs full table scans. At 200k users:
  - Orders table could have millions of rows
  - Full scans at this scale cause timeouts and degrade all users experience

  ## Notes
  - All indexes use IF NOT EXISTS to be safe to re-run
  - Partial indexes (WHERE clause) reduce index size for sparse columns
  - Composite indexes ordered to match most common query patterns
*/

-- ============================================================
-- ORDERS TABLE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider_status
  ON orders(assigned_rider_id, assignment_status)
  WHERE assigned_rider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source_status
  ON orders(order_source, status);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created_desc
  ON orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_user_id_status
  ON orders(vendor_user_id, status)
  WHERE vendor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_created_desc
  ON orders(status, created_at DESC);

-- ============================================================
-- PROFILES TABLE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role_created_desc
  ON profiles(role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended
  ON profiles(is_suspended)
  WHERE is_suspended = true;

-- ============================================================
-- RIDERS TABLE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_riders_zone_status
  ON riders(zone_id, status)
  WHERE zone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_riders_status_created_desc
  ON riders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_riders_active_orders_status
  ON riders(active_orders, status);

-- ============================================================
-- LOGISTICS RATINGS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ratings' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ratings_rider_created_desc ON ratings(rider_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ratings_customer_id ON ratings(customer_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ratings_order_id ON ratings(order_id)';
  END IF;
END $$;

-- ============================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_vendor_available_created
  ON products(vendor_id, is_available, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_available_created_desc
  ON products(is_available, created_at DESC)
  WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_products_category_available
  ON products(category_id, is_available)
  WHERE category_id IS NOT NULL;

-- ============================================================
-- ORDER ITEMS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)';
  END IF;
END $$;

-- ============================================================
-- WALLET TRANSACTIONS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created_desc ON wallet_transactions(user_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallet_transactions_source_app ON wallet_transactions(source_app, user_id)';
  END IF;
END $$;

-- ============================================================
-- REVIEWS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_product_created_desc ON reviews(product_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_user_product ON reviews(user_id, product_id)';
  END IF;
END $$;

-- ============================================================
-- CARTS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carts' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_carts_user_product ON carts(user_id, product_id)';
  END IF;
END $$;

-- ============================================================
-- SERVICE REQUESTS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_requests' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_service_requests_customer_status ON service_requests(customer_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_service_requests_status_created_desc ON service_requests(status, created_at DESC)';
  END IF;
END $$;

-- ============================================================
-- WISHLISTS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlists' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wishlists_user_product ON wishlists(user_id, product_id)';
  END IF;
END $$;

-- ============================================================
-- VENDOR PAYOUTS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_payouts' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_created_desc ON vendor_payouts(vendor_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status, created_at DESC)';
  END IF;
END $$;

-- ============================================================
-- ADVERTS TABLE INDEXES
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adverts' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_adverts_active_created ON adverts(is_active, created_at DESC) WHERE is_active = true';
  END IF;
END $$;
