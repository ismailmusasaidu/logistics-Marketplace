/*
# Create search_logs table for trending search suggestions

## Purpose
The marketplace search autocomplete component queries a `search_logs` table to show
trending searches and calls a `log_search_query` RPC to record each search. Both
were referenced in the frontend code but never created in the database, causing
404 errors at runtime.

## New Tables
- `search_logs`
  - `id` (uuid, primary key)
  - `query` (text, not null) — the search term entered by the user
  - `count` (integer, default 1) — how many times this query has been searched
  - `user_id` (uuid, nullable) — the authenticated user who searched, if any
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now()) — last time this query was counted

## New Functions
- `log_search_query(search_query text)` — SECURITY DEFINER RPC that upserts a
  search term: increments `count` if the query already exists, or inserts a new
  row with count=1. Returns void. Callable by anon and authenticated since
  guests can also search the marketplace.

## Security
- RLS enabled on `search_logs`.
- SELECT granted to anon + authenticated (guests need trending searches).
- INSERT + UPDATE granted to authenticated (via the SECURITY DEFINER RPC, so
  the caller does not need direct INSERT/UPDATE — the function runs as owner).
- The RPC is SECURITY DEFINER so it can write even though callers don't have
  direct INSERT/UPDATE grants. EXECUTE is granted to anon + authenticated.
- SELECT policy allows all users to read trending searches (public data).
- No INSERT/UPDATE/DELETE policies needed for direct table access since all
  writes go through the SECURITY DEFINER RPC.
*/

CREATE TABLE IF NOT EXISTS search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint so the upsert in the RPC works
CREATE UNIQUE INDEX IF NOT EXISTS search_logs_query_key ON search_logs (lower(query));

ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON search_logs TO anon, authenticated;

-- Allow reading trending searches (public data)
DROP POLICY IF EXISTS "search_logs_select_all" ON search_logs;
CREATE POLICY "search_logs_select_all"
ON search_logs FOR SELECT
TO anon, authenticated USING (true);

-- SECURITY DEFINER function to log a search query (upsert + increment count)
CREATE OR REPLACE FUNCTION log_search_query(search_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO search_logs (query, count, user_id)
  VALUES (search_query, 1, auth.uid())
  ON CONFLICT (lower(query))
  DO UPDATE SET
    count = search_logs.count + 1,
    updated_at = now(),
    user_id = COALESCE(auth.uid(), search_logs.user_id);
END;
$$;

-- The RPC needs to write to the table; SECURITY DEFINER handles the privilege.
-- Grant EXECUTE to both anon and authenticated so guests can also log searches.
REVOKE EXECUTE ON FUNCTION log_search_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_search_query(text) TO anon, authenticated;
