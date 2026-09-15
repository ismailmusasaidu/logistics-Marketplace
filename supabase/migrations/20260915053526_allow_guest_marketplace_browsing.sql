-- Let visitors browse the marketplace catalog without an account.
-- Only public, non-sensitive data is exposed; private profile fields stay hidden.

-- Product images: guests can view them.
CREATE POLICY "anon_view_product_images" ON public.product_images
  FOR SELECT TO anon USING (true);

-- Reviews and vendor responses: guests can read them.
CREATE POLICY "anon_view_reviews" ON public.reviews
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_view_review_helpfulness" ON public.review_helpfulness
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_view_vendor_responses" ON public.vendor_responses
  FOR SELECT TO anon USING (true);

-- Vendor directory: public business information.
CREATE POLICY "anon_view_vendors" ON public.vendors
  FOR SELECT TO anon USING (true);

-- Profiles: expose only public vendor fields, and only approved, active vendors.
-- Revoke the broad table-level read from guests, then grant the specific columns.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, role, vendor_status, business_name, business_description, avatar_url, business_address)
  ON public.profiles TO anon;

CREATE POLICY "anon_view_public_vendor_profiles" ON public.profiles
  FOR SELECT TO anon
  USING (role = 'vendor' AND vendor_status = 'approved' AND is_suspended = false);
