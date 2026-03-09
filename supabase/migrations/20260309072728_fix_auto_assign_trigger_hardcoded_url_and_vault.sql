
/*
  # Fix Auto-Assign Trigger: Hardcoded URL Fallback + Store supabase_url in Vault

  ## Problem
  The auto-assign trigger was silently failing on every order because:
  1. `service_role_key` was not stored in vault.decrypted_secrets — the lookup
     returned NULL so the trigger immediately returned without doing anything.
  2. `app.supabase_url` was not set and the JWT-decode fallback was unreliable.

  ## Fix
  - Store `supabase_url` in vault for the URL lookup
  - Rebuild both trigger functions with a 3-level fallback:
      1. `app.supabase_url` setting (if configured)
      2. vault `supabase_url` secret
      3. hardcoded project URL as final fallback
  - The `service_role_key` MUST still be added to the vault manually (or via
    the Supabase dashboard > Vault). This migration stores the URL only.
  - Until service_role_key is in vault, the trigger logs a WARNING per order.

  ## Tables/Functions Modified
  - `auto_assign_rider_on_order_creation()` — rebuilt with URL fallback chain
  - `check_and_reassign_timed_out_orders()` — rebuilt with URL fallback chain
  - `trigger_auto_assign_rider` on orders — recreated
*/

-- Store supabase_url in vault (non-sensitive reference value)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url') THEN
    PERFORM vault.create_secret('https://uutsoqjcbsiplwhkgstz.supabase.co', 'supabase_url');
  ELSE
    UPDATE vault.secrets
    SET secret = vault._encrypt_secret('https://uutsoqjcbsiplwhkgstz.supabase.co')
    WHERE name = 'supabase_url';
  END IF;
END $$;

-- Rebuild the trigger function with 3-level URL fallback + hardcoded final fallback
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
  -- Only fire for pending logistics orders without a rider,
  -- OR when assignment resets back to pending
  IF NOT (
    (TG_OP = 'INSERT'
      AND NEW.status = 'pending'
      AND NEW.assigned_rider_id IS NULL
      AND (NEW.order_source = 'logistics' OR NEW.order_source IS NULL))
    OR
    (TG_OP = 'UPDATE'
      AND NEW.assignment_status = 'pending'
      AND (OLD.assignment_status IS DISTINCT FROM 'pending')
      AND NEW.assigned_rider_id IS NULL
      AND (NEW.order_source = 'logistics' OR NEW.order_source IS NULL))
  ) THEN
    RETURN NEW;
  END IF;

  -- Get service role key from vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'auto_assign_rider: service_role_key not found in vault — skipping assignment for order %', NEW.id;
    RETURN NEW;
  END IF;

  -- URL: try app setting first
  BEGIN
    supabase_url := current_setting('app.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  -- URL: try vault
  IF supabase_url IS NULL OR supabase_url = '' THEN
    SELECT decrypted_secret INTO supabase_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;
  END IF;

  -- URL: hardcoded final fallback
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://uutsoqjcbsiplwhkgstz.supabase.co';
  END IF;

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

DROP TRIGGER IF EXISTS trigger_auto_assign_rider ON orders;

CREATE TRIGGER trigger_auto_assign_rider
  AFTER INSERT OR UPDATE OF assignment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_rider_on_order_creation();

-- Rebuild timeout enforcement function with same URL fallback chain
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
    RAISE WARNING 'check_and_reassign_timed_out_orders: service_role_key not found in vault';
    RETURN;
  END IF;

  BEGIN
    supabase_url := current_setting('app.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    SELECT decrypted_secret INTO supabase_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;
  END IF;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://uutsoqjcbsiplwhkgstz.supabase.co';
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
