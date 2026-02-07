/*
  # Enable Realtime for Vendor Settings

  This migration enables real-time updates for the vendor_settings table.
  This allows vendor dashboards to automatically update when settings change
  (e.g., when a vendor updates or deletes their store banner).

  ## Changes
  - Enable real-time replication for vendor_settings table
*/

ALTER PUBLICATION supabase_realtime ADD TABLE vendor_settings;
