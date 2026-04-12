/*
  # Add admin SELECT policy for service_requests

  ## Problem
  Admins could not view any service requests in the admin dashboard because
  there was no SELECT RLS policy granting admins read access.
  Only customers had a SELECT policy (restricted to their own rows).

  ## Change
  - Add a new SELECT policy allowing users with role = 'admin' to read all service requests
*/

CREATE POLICY "Admins can view all service requests"
  ON service_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );
