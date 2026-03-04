/*
  # Allow riders to read customer profiles for their assigned orders

  ## Problem
  The existing profiles SELECT policy only allows reading profiles where:
  - id = auth.uid() (own profile)
  - role IN ('vendor', 'admin') (public vendor/admin profiles)

  This blocks riders from reading the customer profile when they join
  profiles to their assigned orders. The join returns null, so no emails
  are ever sent from the rider side (on accept, out_for_delivery, delivered,
  cancelled).

  ## Change
  Add a new SELECT policy that lets an authenticated rider (identified via
  the riders table where riders.user_id = auth.uid()) read the profile of
  any customer whose order is assigned to them.
*/

CREATE POLICY "Riders can view profiles of their assigned order customers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN riders r ON (r.id = o.assigned_rider_id OR r.id = o.rider_id)
      WHERE
        o.customer_id = profiles.id
        AND r.user_id = auth.uid()
    )
  );
