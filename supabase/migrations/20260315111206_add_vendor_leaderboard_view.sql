/*
  # Vendor Performance Leaderboard View

  ## Summary
  Creates a materialized-like view (as a regular view) for the vendor leaderboard
  that powers the "Top Vendors" and "Most Ordered This Week" features on the 
  customer home screen.

  ## New Views
  - `vendor_leaderboard` — Aggregates per-vendor stats:
      - `vendor_id`: the vendor's profile user_id
      - `business_name`: from profiles table
      - `logo_url`: vendor banner/logo (from vendor_settings if available, else null)
      - `avg_rating`: average product rating across all their products
      - `total_products`: number of active products
      - `weekly_order_count`: number of delivered orders placed in the last 7 days
      - `total_order_count`: all-time delivered order count

  ## Security
  - View is accessible to authenticated users (read-only by nature of views)
  - No RLS needed on a view — underlying tables already have RLS

  ## Notes
  - Only vendors with `vendor_status = 'approved'` and `is_suspended = false` appear
  - `weekly_order_count` drives the "Most Ordered This Week" badge logic
  - `avg_rating` drives the top-rated highlight ranking
*/

CREATE OR REPLACE VIEW vendor_leaderboard AS
SELECT
  p.id AS vendor_id,
  p.business_name,
  p.avatar_url AS logo_url,
  COALESCE(ROUND(AVG(pr.rating)::numeric, 1), 0) AS avg_rating,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_available = true) AS total_products,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status = 'delivered'
    AND o.created_at >= NOW() - INTERVAL '7 days'
  ) AS weekly_order_count,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered') AS total_order_count
FROM profiles p
LEFT JOIN products pr ON pr.vendor_id = p.id
LEFT JOIN orders o ON o.vendor_id = p.id
WHERE
  p.role = 'vendor'
  AND p.vendor_status = 'approved'
  AND p.is_suspended = false
GROUP BY p.id, p.business_name, p.avatar_url;
