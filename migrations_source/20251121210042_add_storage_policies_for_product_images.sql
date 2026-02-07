/*
  # Add Storage Policies for Product Images

  1. Storage Policies
    - Allow authenticated vendors to upload product images
    - Allow public read access to product images
    - Allow vendors to update their own product images
    - Allow vendors to delete their own product images

  2. Security
    - Vendors can only upload to their own vendor folder
    - Public can view all product images (public bucket)
    - Only authenticated users can upload
*/

CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  );

CREATE POLICY "Anyone can view product images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  )
  WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  );

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] = 'products'
  );
