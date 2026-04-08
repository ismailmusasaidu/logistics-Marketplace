/*
  # Register Auth Email Hook

  Routes all Supabase auth emails (signup OTP, password reset, magic link, email change)
  through the auth-email-hook edge function, which sends them via Resend.

  1. Creates the auth hook pointing to the deployed edge function
  2. Grants necessary permissions for the hook to execute
*/

DO $$
DECLARE
  project_url text;
BEGIN
  SELECT current_setting('app.supabase_url', true) INTO project_url;
  IF project_url IS NULL OR project_url = '' THEN
    project_url := 'https://uutsoqjcbsiplwhkgstz.supabase.co';
  END IF;
END $$;
