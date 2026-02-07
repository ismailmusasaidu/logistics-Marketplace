/*
  # Enhanced Review System

  ## Overview
  This migration adds comprehensive review features including verified purchases, vendor responses, 
  helpfulness voting, and enhanced moderation capabilities.

  ## Changes

  ### 1. Reviews Table Enhancements
  - Add `verified_purchase` column to indicate reviews from actual buyers
  - Add unique constraint to prevent duplicate reviews per user per product
  - Add indexes for better query performance

  ### 2. New Tables
  - `vendor_responses` - Allows vendors to reply to reviews on their products
    - `id` (uuid, primary key)
    - `review_id` (uuid, foreign key to reviews)
    - `vendor_id` (uuid, foreign key to profiles)
    - `response_text` (text)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  - `review_helpfulness` - Tracks helpful votes on reviews
    - `id` (uuid, primary key)
    - `review_id` (uuid, foreign key to reviews)
    - `user_id` (uuid, foreign key to auth.users)
    - `is_helpful` (boolean)
    - `created_at` (timestamp)

  ### 3. Security (RLS Policies)
  
  #### Reviews
  - Customers can edit/delete their own reviews
  - Admins can delete any review
  - One review per product per user constraint

  #### Vendor Responses
  - Vendors can create/edit/delete responses to reviews on their own products
  - Everyone can read vendor responses
  - Admins can delete any vendor response

  #### Review Helpfulness
  - Authenticated users can vote once per review
  - Users can update their own votes
  - Everyone can read helpfulness votes

  ### 4. Important Notes
  - Data integrity: Uses foreign key constraints with CASCADE deletes
  - Security: All tables have RLS enabled with restrictive policies
  - Performance: Indexes added for common query patterns
*/

-- Step 1: Add verified_purchase column to reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'verified_purchase'
  ) THEN
    ALTER TABLE reviews ADD COLUMN verified_purchase boolean DEFAULT false;
  END IF;
END $$;

-- Step 2: Update existing reviews to mark as verified if they have an order_id
UPDATE reviews 
SET verified_purchase = true 
WHERE order_id IS NOT NULL;

-- Step 3: Add unique constraint for one review per product per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'reviews_user_product_unique'
  ) THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_user_product_unique 
    UNIQUE (user_id, product_id);
  END IF;
END $$;

-- Step 4: Create vendor_responses table
CREATE TABLE IF NOT EXISTS vendor_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 5: Create review_helpfulness table
CREATE TABLE IF NOT EXISTS review_helpfulness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_responses_review_id ON vendor_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_vendor_responses_vendor_id ON vendor_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review_id ON review_helpfulness(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpfulness_user_id ON review_helpfulness(user_id);

-- Step 7: Enable RLS on new tables
ALTER TABLE vendor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpfulness ENABLE ROW LEVEL SECURITY;

-- Step 8: Add RLS policies for reviews (enhance existing)

-- Allow users to update their own reviews
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to delete any review
DROP POLICY IF EXISTS "Admins can delete any review" ON reviews;
CREATE POLICY "Admins can delete any review"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Step 9: Add RLS policies for vendor_responses

-- Everyone can read vendor responses
CREATE POLICY "Anyone can read vendor responses"
  ON vendor_responses FOR SELECT
  TO authenticated
  USING (true);

-- Vendors can create responses to reviews on their own products
CREATE POLICY "Vendors can create responses to their product reviews"
  ON vendor_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = vendor_id
    AND EXISTS (
      SELECT 1 FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.id = review_id
      AND p.vendor_id = (
        SELECT id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Vendors can update their own responses
CREATE POLICY "Vendors can update own responses"
  ON vendor_responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

-- Vendors can delete their own responses
CREATE POLICY "Vendors can delete own responses"
  ON vendor_responses FOR DELETE
  TO authenticated
  USING (auth.uid() = vendor_id);

-- Admins can delete any vendor response
CREATE POLICY "Admins can delete any vendor response"
  ON vendor_responses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Step 10: Add RLS policies for review_helpfulness

-- Everyone can read helpfulness votes
CREATE POLICY "Anyone can read review helpfulness"
  ON review_helpfulness FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can vote on reviews
CREATE POLICY "Users can vote on review helpfulness"
  ON review_helpfulness FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update own helpfulness votes"
  ON review_helpfulness FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete own helpfulness votes"
  ON review_helpfulness FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 11: Create function to auto-update vendor_responses updated_at
CREATE OR REPLACE FUNCTION update_vendor_response_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Create trigger for vendor_responses updated_at
DROP TRIGGER IF EXISTS trigger_vendor_responses_updated_at ON vendor_responses;
CREATE TRIGGER trigger_vendor_responses_updated_at
  BEFORE UPDATE ON vendor_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_response_updated_at();

-- Step 13: Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE vendor_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE review_helpfulness;