/*
  # Fix infinite recursion in rider customer profile read policy

  ## Problem
  The policy "Riders can view profiles of their assigned order customers" queries
  the orders table which itself has RLS policies that may reference profiles,
  causing infinite recursion when any user loads their profile.

  ## Fix
  1. Drop the recursive policy
  2. Create a SECURITY DEFINER function that checks rider-customer assignment
     without triggering RLS on profiles
  3. Re-create the policy using this function
*/

DROP POLICY IF EXISTS "Riders can view profiles of their assigned order customers" ON profiles;

CREATE OR REPLACE FUNCTION is_rider_assigned_to_customer(customer_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM orders o
    JOIN riders r ON (r.id = o.assigned_rider_id OR r.id = o.rider_id)
    WHERE o.customer_id = customer_profile_id
      AND r.user_id = auth.uid()
  );
$$;

CREATE POLICY "Riders can view profiles of their assigned order customers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_rider_assigned_to_customer(id)
  );
