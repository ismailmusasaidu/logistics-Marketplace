/*
  # Enable Realtime for Vendor Dashboard

  1. Changes
    - Enable realtime replication for products table
    - Enable realtime replication for orders table
  
  2. Purpose
    - Allows vendor dashboard to receive real-time updates when products or orders change
    - Stats will update automatically without page refresh
*/

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
