/*
  # Require Email Confirmation Before Login

  ## Summary
  Removes all auto-email-confirmation triggers so that new users must verify
  their email address before they can sign in.

  ## Changes
  - Drops all known auto-confirm triggers from auth.users
  - Drops the auto_confirm_user_email function (CASCADE)
  - Existing confirmed users are unaffected

  ## Notes
  - After this migration, Supabase will send a confirmation email on signup
  - Users who have not confirmed will get an "Email not confirmed" error on login
  - Make sure Supabase Auth email confirmation is ENABLED in the project dashboard
*/

DROP TRIGGER IF EXISTS on_auth_user_created_confirm_email ON auth.users;
DROP TRIGGER IF EXISTS confirm_user_email_trigger ON auth.users;

DROP FUNCTION IF EXISTS auto_confirm_user_email() CASCADE;
