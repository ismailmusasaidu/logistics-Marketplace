/*
  # Update handle_new_user Trigger to Create Riders Table Entry

  ## Summary
  Updates the handle_new_user trigger function to automatically create a row
  in the riders table when a new user registers with role = 'rider'.

  ## Problem Fixed
  Previously, riders could sign up with vehicle/license info in metadata, but
  no riders table entry was created automatically. This meant:
  1. The admin could not assign orders to the rider
  2. The rider had no profile entry in the riders table
  3. Rider had to manually create their entry from the profile screen

  ## Changes
  1. Updated handle_new_user() to read vehicle_type, vehicle_number, license_number
     from user metadata
  2. When role = 'rider', automatically inserts a row into public.riders with
     the vehicle information from signup metadata
  3. The riders entry is created with status = 'offline' by default

  ## Security
  Function uses SECURITY DEFINER to run with elevated privileges
  search_path set to public for safety
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_name text;
  user_phone text;
  v_business_name text;
  v_business_description text;
  v_business_address text;
  v_business_phone text;
  v_business_license text;
  v_vendor_status text;
  v_vehicle_type text;
  v_vehicle_number text;
  v_license_number text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_business_name := NEW.raw_user_meta_data->>'business_name';
  v_business_description := NEW.raw_user_meta_data->>'business_description';
  v_business_address := NEW.raw_user_meta_data->>'business_address';
  v_business_phone := NEW.raw_user_meta_data->>'business_phone';
  v_business_license := NEW.raw_user_meta_data->>'business_license';
  v_vendor_status := COALESCE(NEW.raw_user_meta_data->>'vendor_status', 'pending');
  v_vehicle_type := COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'bike');
  v_vehicle_number := COALESCE(NEW.raw_user_meta_data->>'vehicle_number', '');
  v_license_number := COALESCE(NEW.raw_user_meta_data->>'license_number', '');

  INSERT INTO public.profiles (
    id, email, full_name, phone, role,
    business_name, business_description, business_address,
    business_phone, business_license, vendor_status
  )
  VALUES (
    NEW.id, NEW.email, user_name, user_phone, user_role,
    v_business_name, v_business_description, v_business_address,
    v_business_phone, v_business_license,
    CASE WHEN user_role IN ('vendor', 'rider') THEN v_vendor_status ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone),
    role = COALESCE(NULLIF(EXCLUDED.role, 'customer'), public.profiles.role),
    business_name = COALESCE(EXCLUDED.business_name, public.profiles.business_name),
    business_description = COALESCE(EXCLUDED.business_description, public.profiles.business_description),
    business_address = COALESCE(EXCLUDED.business_address, public.profiles.business_address),
    business_phone = COALESCE(EXCLUDED.business_phone, public.profiles.business_phone),
    business_license = COALESCE(EXCLUDED.business_license, public.profiles.business_license),
    vendor_status = COALESCE(EXCLUDED.vendor_status, public.profiles.vendor_status);

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF user_role = 'rider' THEN
    INSERT INTO public.riders (user_id, vehicle_type, vehicle_number, license_number, status)
    VALUES (NEW.id, v_vehicle_type, v_vehicle_number, v_license_number, 'offline')
    ON CONFLICT (user_id) DO UPDATE SET
      vehicle_type = CASE WHEN EXCLUDED.vehicle_type != '' THEN EXCLUDED.vehicle_type ELSE public.riders.vehicle_type END,
      vehicle_number = CASE WHEN EXCLUDED.vehicle_number != '' THEN EXCLUDED.vehicle_number ELSE public.riders.vehicle_number END,
      license_number = CASE WHEN EXCLUDED.license_number != '' THEN EXCLUDED.license_number ELSE public.riders.license_number END;
  END IF;

  RETURN NEW;
END;
$$;
