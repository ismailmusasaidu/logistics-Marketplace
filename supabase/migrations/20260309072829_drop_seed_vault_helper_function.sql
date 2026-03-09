
/*
  # Drop one-time vault seeding helper

  The seed_service_role_key_to_vault function was used once to store the
  service_role_key in the vault. It is no longer needed and is removed
  to reduce attack surface.
*/

DROP FUNCTION IF EXISTS seed_service_role_key_to_vault(text);
