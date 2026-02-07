/*
  # Enable Real-time for Wishlists

  1. Changes
    - Enable real-time updates for the wishlists table to support live badge updates
  
  2. Purpose
    - Allows the wishlist badge to update instantly when items are added or removed
    - Provides a better user experience with real-time feedback
*/

-- Enable real-time for wishlists table
ALTER PUBLICATION supabase_realtime ADD TABLE wishlists;
