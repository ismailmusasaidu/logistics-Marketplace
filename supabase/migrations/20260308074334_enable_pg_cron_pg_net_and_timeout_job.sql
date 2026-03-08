/*
  # Enable pg_cron and pg_net, schedule timeout enforcement

  1. Changes
    - Enable pg_cron extension (job scheduler)
    - Enable pg_net extension (async HTTP from triggers)
    - Create a cron job that runs every minute calling check_and_reassign_timed_out_orders()
      so orders whose assignment timer expired without a rider response get reassigned

  2. Notes
    - pg_net is required by the auto-assign trigger to make async HTTP calls
    - pg_cron runs the timeout checker on a 1-minute schedule automatically
    - The cron job is idempotent: safe to run repeatedly
*/

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'reassign-timed-out-orders',
  '* * * * *',
  $$SELECT check_and_reassign_timed_out_orders()$$
);
