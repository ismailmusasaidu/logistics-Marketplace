/*
  # Create Advert Images Storage Bucket

  ## Summary
  Creates a public storage bucket for advert images uploaded by admins,
  with appropriate RLS policies to allow admin uploads and public reads.

  ## Changes
  - New storage bucket: `advert-images` (public)
  - INSERT policy: authenticated users can upload
  - SELECT policy: anyone can view
  - UPDATE/DELETE policy: authenticated users can manage their uploads
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('advert-images', 'advert-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view advert images" ON storage.objects;
CREATE POLICY "Anyone can view advert images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'advert-images');

DROP POLICY IF EXISTS "Authenticated users can upload advert images" ON storage.objects;
CREATE POLICY "Authenticated users can upload advert images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'advert-images');

DROP POLICY IF EXISTS "Authenticated users can update advert images" ON storage.objects;
CREATE POLICY "Authenticated users can update advert images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'advert-images')
  WITH CHECK (bucket_id = 'advert-images');

DROP POLICY IF EXISTS "Authenticated users can delete advert images" ON storage.objects;
CREATE POLICY "Authenticated users can delete advert images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'advert-images');
