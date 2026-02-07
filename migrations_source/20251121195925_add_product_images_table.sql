/*
  # Add Product Images Table

  1. New Tables
    - `product_images`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to products)
      - `image_url` (text, image URL)
      - `display_order` (integer, order of images)
      - `is_primary` (boolean, primary product image)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `product_images` table
    - Add policy for authenticated vendors to insert their product images
    - Add policy for authenticated vendors to update their product images
    - Add policy for authenticated vendors to delete their product images
    - Add policy for all users to view product images
  
  3. Important Notes
    - Supports multiple images per product
    - Primary image flag for main product display
    - Display order for image gallery sequencing
*/

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order ON product_images(display_order);

-- Enable RLS
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Policy for viewing product images (all authenticated users)
CREATE POLICY "Anyone can view product images"
  ON product_images
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for vendors to insert their product images
CREATE POLICY "Vendors can insert their product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND products.vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for vendors to update their product images
CREATE POLICY "Vendors can update their product images"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND products.vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND products.vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for vendors to delete their product images
CREATE POLICY "Vendors can delete their product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND products.vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );