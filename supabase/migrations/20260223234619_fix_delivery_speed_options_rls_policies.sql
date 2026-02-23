/*
  # Fix delivery_speed_options RLS policies

  ## Problem
  The delivery_speed_options table was missing INSERT, UPDATE, and DELETE policies,
  causing admin create/update/delete operations to fail silently.
  The existing SELECT policy also only showed active records, preventing admins
  from managing inactive speed options.

  ## Changes
  1. Drop the existing overly-restrictive SELECT policy
  2. Add SELECT policy for all authenticated users (admins see all, customers see active)
  3. Add INSERT policy for admins only
  4. Add UPDATE policy for admins only
  5. Add DELETE policy for admins only
*/

DROP POLICY IF EXISTS "Authenticated users can read active speed options" ON delivery_speed_options;

CREATE POLICY "Admins can read all speed options"
  ON delivery_speed_options FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR (SELECT is_admin(auth.uid()))
  );

CREATE POLICY "Admins can insert speed options"
  ON delivery_speed_options FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_admin(auth.uid()))
  );

CREATE POLICY "Admins can update speed options"
  ON delivery_speed_options FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin(auth.uid())))
  WITH CHECK ((SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can delete speed options"
  ON delivery_speed_options FOR DELETE
  TO authenticated
  USING ((SELECT is_admin(auth.uid())));
