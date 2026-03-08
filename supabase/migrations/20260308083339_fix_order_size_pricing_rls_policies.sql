/*
  # Fix order_size_pricing RLS policies

  The existing policies use is_admin() (no args) but the working pattern
  in this database uses is_admin(auth.uid()) with a uuid argument.
  Recreate all non-SELECT policies to use the correct function signature.
*/

DROP POLICY IF EXISTS "Admins can insert order size pricing" ON order_size_pricing;
DROP POLICY IF EXISTS "Admins can update order size pricing" ON order_size_pricing;
DROP POLICY IF EXISTS "Admins can delete order size pricing" ON order_size_pricing;

CREATE POLICY "Admins can insert order size pricing"
  ON order_size_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update order size pricing"
  ON order_size_pricing
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete order size pricing"
  ON order_size_pricing
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));
