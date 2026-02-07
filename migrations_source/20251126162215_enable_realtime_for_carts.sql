/*
  # Enable Realtime for Carts Table

  1. Changes
    - Enable realtime replication for the `carts` table
    - This allows the cart badge to update in real-time when cart items are added, updated, or removed

  2. Purpose
    - Provides instant updates to the cart badge count without requiring page refresh
    - Improves user experience by showing accurate cart counts immediately
*/

-- Enable realtime for carts table
ALTER PUBLICATION supabase_realtime ADD TABLE carts;
