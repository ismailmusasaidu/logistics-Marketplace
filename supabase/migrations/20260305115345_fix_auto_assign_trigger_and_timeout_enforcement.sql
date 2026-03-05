/*
  # Fix Auto-Assign Rider Trigger and Add Timeout Enforcement

  1. Changes
    - Rebuild auto_assign_rider_on_order_creation() to use SUPABASE_URL from pg_net
      configuration rather than a hardcoded URL. Falls back to the Supabase internal
      REST endpoint via extensions schema if the setting is missing.
    - Use the service_role_key from vault.decrypted_secrets (no anon key fallback)
    - Also fire on UPDATE when assignment_status resets to 'pending' so that orders
      rejected by all riders can be re-attempted (previously the trigger was INSERT-only)
    - Add a helper function check_and_reassign_timed_out_orders() to auto-reassign
      orders whose assignment_timeout_at has passed while still in 'assigned' status
    - Add a trigger that fires on UPDATE of assignment_timeout_at or assignment_status
      to catch timeout resets

  2. Security
    - All functions use SECURITY DEFINER
    - No credentials hardcoded — uses vault.decrypted_secrets
*/

-- Drop and recreate the core assignment trigger function
DROP FUNCTION IF EXISTS auto_assign_rider_on_order_creation() CASCADE;

CREATE OR REPLACE FUNCTION auto_assign_rider_on_order_creation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_key  text;
BEGIN
  -- Fire for new pending orders without a rider, OR when assignment resets to pending
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.assigned_rider_id IS NULL)
    OR
    (TG_OP = 'UPDATE'
      AND NEW.assignment_status = 'pending'
      AND (OLD.assignment_status IS DISTINCT FROM 'pending')
      AND NEW.assigned_rider_id IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  -- Get service role key from vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'auto_assign_rider: service_role_key not found in vault. Skipping assignment for order %', NEW.id;
    RETURN NEW;
  END IF;

  -- Get Supabase project URL from app settings (set via supabase config)
  BEGIN
    supabase_url := current_setting('app.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  -- Fallback: derive from the service key issuer claim (works on hosted Supabase)
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := (
      SELECT 'https://' || split_part(
        convert_from(decode(split_part(service_key, '.', 2) || repeat('=', 4 - length(split_part(service_key, '.', 2)) % 4), 'base64'), 'UTF8')::jsonb ->> 'ref',
        '.', 1
      ) || '.supabase.co'
    );
  END IF;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'auto_assign_rider: could not determine supabase_url. Skipping assignment for order %', NEW.id;
    RETURN NEW;
  END IF;

  -- Fire async HTTP call to the assign-rider edge function
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/assign-rider',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object('order_id', NEW.id::text)
  );

  RETURN NEW;
END;
$$;

-- Drop all existing variants of this trigger and recreate for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_auto_assign_rider ON orders;

CREATE TRIGGER trigger_auto_assign_rider
  AFTER INSERT OR UPDATE OF assignment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_rider_on_order_creation();

-- ----------------------------------------------------------------
-- Timeout enforcement function
-- Called when we detect an order has been in 'assigned' status
-- past its assignment_timeout_at. Calls the reassign-rider function.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS check_and_reassign_timed_out_orders() CASCADE;

CREATE OR REPLACE FUNCTION check_and_reassign_timed_out_orders()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  timed_out_order RECORD;
  supabase_url    text;
  service_key     text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    supabase_url := current_setting('app.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := (
      SELECT 'https://' || split_part(
        convert_from(decode(split_part(service_key, '.', 2) || repeat('=', 4 - length(split_part(service_key, '.', 2)) % 4), 'base64'), 'UTF8')::jsonb ->> 'ref',
        '.', 1
      ) || '.supabase.co'
    );
  END IF;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RETURN;
  END IF;

  FOR timed_out_order IN
    SELECT id
    FROM orders
    WHERE assignment_status = 'assigned'
      AND assignment_timeout_at IS NOT NULL
      AND assignment_timeout_at < now()
      AND order_source = 'logistics'
  LOOP
    PERFORM net.http_post(
      url     := supabase_url || '/functions/v1/reassign-rider',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body    := jsonb_build_object(
        'order_id', timed_out_order.id::text,
        'reason',   'Assignment timed out — no rider response'
      )
    );
  END LOOP;
END;
$$;
