/*
  # Add Wishlist Feature

  1. New Tables
    - `wishlists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `product_id` (uuid, references products)
      - `created_at` (timestamp)
      - Unique constraint on (user_id, product_id) to prevent duplicates

  2. Security
    - Enable RLS on `wishlists` table
    - Add policy for users to view their own wishlist items
    - Add policy for users to add items to their own wishlist
    - Add policy for users to remove items from their own wishlist

  3. Indexes
    - Index on user_id for faster queries
    - Index on product_id for faster lookups
*/

-- Create wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS wishlists_product_id_idx ON wishlists(product_id);

-- Enable RLS
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own wishlist items"
  ON wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add items to their own wishlist"
  ON wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove items from their own wishlist"
  ON wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);