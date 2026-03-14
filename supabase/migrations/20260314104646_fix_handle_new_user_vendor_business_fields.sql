/*
  # Fix handle_new_user trigger to include vendor business fields

  ## Problem
  When a vendor registers, their business info (business_name, business_description,
  business_address, business_phone, business_license, vendor_status) was being set
  via a separate profile UPDATE after signup. With email confirmation enabled, the user
  has no active session after signUp, so RLS blocks the UPDATE call, leaving the profile
  without business data.

  ## Solution
  Update the handle_new_user trigger function to also read vendor business fields from
  user metadata and populate the profile on INSERT. The register screen will pass this
  data in signUp options.data.

  ## Changes
  - Updated handle_new_user function to read business_name, business_description,
    business_address, business_phone, business_license, and vendor_status from metadata
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

  RETURN NEW;
END;
$$;
