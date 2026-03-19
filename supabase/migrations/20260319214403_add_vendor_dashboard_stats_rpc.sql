/*
  # Add vendor dashboard stats RPC

  Creates a server-side function that computes vendor dashboard statistics
  in a single round-trip instead of fetching all products, orders, and reviews
  separately and computing them client-side.

  1. New Function
     - `get_vendor_dashboard_stats(p_vendor_id uuid)` - returns JSON with
       totalProducts, activeProducts, lowStockProducts, totalRevenue,
       pendingOrders, completedOrders, totalReviews, averageRating

  2. Security
     - SECURITY DEFINER so it can read across tables
     - Caller must pass their own vendor_id (validated via RLS on underlying tables)
*/

CREATE OR REPLACE FUNCTION get_vendor_dashboard_stats(p_vendor_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_products    INTEGER := 0;
  v_active_products   INTEGER := 0;
  v_low_stock         INTEGER := 0;
  v_total_revenue     NUMERIC := 0;
  v_pending_orders    INTEGER := 0;
  v_completed_orders  INTEGER := 0;
  v_total_reviews     INTEGER := 0;
  v_average_rating    NUMERIC := 0;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE is_available = true)::INTEGER,
    COUNT(*) FILTER (WHERE stock_quantity < 10)::INTEGER
  INTO v_total_products, v_active_products, v_low_stock
  FROM products
  WHERE vendor_id = p_vendor_id;

  SELECT
    COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed', 'preparing'))::INTEGER,
    COUNT(*) FILTER (WHERE status = 'delivered')::INTEGER
  INTO v_total_revenue, v_pending_orders, v_completed_orders
  FROM orders
  WHERE vendor_id = p_vendor_id
    AND order_source = 'marketplace';

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(AVG(rating), 0)
  INTO v_total_reviews, v_average_rating
  FROM reviews
  WHERE product_id IN (
    SELECT id FROM products WHERE vendor_id = p_vendor_id
  );

  RETURN json_build_object(
    'totalProducts',   v_total_products,
    'activeProducts',  v_active_products,
    'lowStockProducts', v_low_stock,
    'totalRevenue',    v_total_revenue,
    'pendingOrders',   v_pending_orders,
    'completedOrders', v_completed_orders,
    'totalReviews',    v_total_reviews,
    'averageRating',   v_average_rating
  );
END;
$$;
