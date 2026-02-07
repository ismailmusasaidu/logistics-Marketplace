/*
  # Fix Review Insert Policy

  ## Changes
  - Drop the restrictive review insert policy that requires order_id
  - Create a new policy that allows authenticated users to submit reviews
  - Users can submit reviews for any product, with or without an order_id
  - This enables both purchase-verified reviews (with order_id) and general reviews (without order_id)

  ## Security
  - Policy still ensures user_id matches the authenticated user
  - Prevents users from submitting reviews as other users
*/

DROP POLICY IF EXISTS "Users can create reviews for purchased products" ON reviews;

CREATE POLICY "Authenticated users can create reviews"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );
