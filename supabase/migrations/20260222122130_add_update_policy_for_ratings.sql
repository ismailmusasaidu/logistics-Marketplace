/*
  # Add UPDATE policy for ratings table

  1. Problem
    - Customers cannot update their existing rating because there is no UPDATE policy
    - The upsert (insert-or-update) on the ratings table fails with an RLS violation
      when a rating already exists for the order

  2. Solution
    - Add an UPDATE policy so customers can update their own ratings
    - This allows the upsert with onConflict: 'order_id' to work correctly

  3. Security
    - Only the original customer who created the rating can update it
    - Both USING and WITH CHECK verify ownership via auth.uid()
*/

CREATE POLICY "Customers can update own ratings"
  ON public.ratings
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
