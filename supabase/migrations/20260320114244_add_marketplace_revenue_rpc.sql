/*
  # Add Marketplace Revenue RPC Function

  ## Summary
  Creates a database-level aggregation function for calculating marketplace revenue.
  This replaces the previous approach of fetching ALL orders to the frontend and
  summing totals in JavaScript - which would be catastrophically slow at 200k users.

  ## New Function
  - `get_marketplace_revenue()` - Returns the sum of all delivered marketplace orders

  ## Why This Matters
  - Before: Fetched entire orders table (could be millions of rows) to calculate revenue
  - After: Single SQL aggregation query returns one number
  - Performance improvement: 99%+ reduction in data transfer and query time

  ## Security
  - Function uses SECURITY DEFINER to run with elevated privileges
  - search_path set to public for safety
*/

CREATE OR REPLACE FUNCTION get_marketplace_revenue()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(total), 0)
  FROM orders
  WHERE status = 'delivered'
    AND order_source = 'marketplace';
$$;
