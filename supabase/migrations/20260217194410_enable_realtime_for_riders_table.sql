/*
  # Enable Realtime for Riders Table

  ## Purpose
  The admin dashboard and admin riders page need to receive live push updates
  whenever a rider changes their online/offline status. Without this, the
  `riders` table changes are not broadcast and the admin UI only updates on
  manual pull-to-refresh.

  ## Changes
  - Adds the `riders` table to the Supabase realtime publication so that
    UPDATE events are pushed to subscribed clients instantly.

  ## Notes
  - Wrapped in a DO block so it is safe to run multiple times (idempotent).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'riders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE riders;
  END IF;
END $$;
