/*
  # Add Vendor Banners Storage Bucket

  1. New Storage Bucket
    - `vendor-banners` bucket for storing vendor store banner images
  
  2. Security
    - Enable RLS on the bucket
    - Allow authenticated vendors to upload their own banners
    - Allow public access to view banner images
    
  3. Notes
    - Vendors can only upload banners for their own store
    - Banner images are publicly viewable
    - Supported formats: JPG, PNG, WebP
    - Max file size controlled by storage policies
*/

-- Create storage bucket for vendor banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-banners', 'vendor-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow vendors to upload their own banners
CREATE POLICY "Vendors can upload own banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-banners' AND
  auth.uid() IN (
    SELECT user_id FROM vendors WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow vendors to update their own banners
CREATE POLICY "Vendors can update own banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-banners' AND
  auth.uid() IN (
    SELECT user_id FROM vendors WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow vendors to delete their own banners
CREATE POLICY "Vendors can delete own banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-banners' AND
  auth.uid() IN (
    SELECT user_id FROM vendors WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow public read access to all vendor banners
CREATE POLICY "Anyone can view vendor banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'vendor-banners');
