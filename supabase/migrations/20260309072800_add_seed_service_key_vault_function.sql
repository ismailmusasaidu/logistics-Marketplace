
/*
  # Add helper function to seed service_role_key into vault

  This function is called once by an edge function that has access to the
  SUPABASE_SERVICE_ROLE_KEY environment variable. It stores the key in vault
  so the auto-assign trigger can use it.
*/

CREATE OR REPLACE FUNCTION seed_service_role_key_to_vault(p_key text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    UPDATE vault.secrets
    SET secret = p_key
    WHERE name = 'service_role_key';
  ELSE
    PERFORM vault.create_secret(p_key, 'service_role_key');
  END IF;
END;
$$;
