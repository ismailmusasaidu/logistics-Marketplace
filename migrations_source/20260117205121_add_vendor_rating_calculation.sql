/*
  # Add Vendor Rating Calculation System

  1. Functions
    - `calculate_vendor_rating` - Calculates average rating from all vendor's products
    - `update_vendor_rating_on_product_change` - Trigger function to update vendor rating
  
  2. Triggers
    - Updates vendor rating when product ratings change
  
  3. Changes
    - Automatically maintains vendor rating based on product reviews
*/

-- Function to calculate vendor rating based on all their products
CREATE OR REPLACE FUNCTION calculate_vendor_rating(vendor_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  avg_rating NUMERIC;
BEGIN
  SELECT AVG(rating)
  INTO avg_rating
  FROM products
  WHERE vendor_id = vendor_user_id
    AND rating > 0
    AND total_reviews > 0;
  
  -- If no products have ratings, return 0
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update vendor rating when product rating changes
CREATE OR REPLACE FUNCTION update_vendor_rating_on_product_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the vendor's rating based on all their products
  UPDATE vendors
  SET rating = calculate_vendor_rating(NEW.vendor_id),
      updated_at = now()
  WHERE user_id = NEW.vendor_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_vendor_rating ON products;

-- Create trigger to update vendor rating when product rating changes
CREATE TRIGGER trigger_update_vendor_rating
  AFTER INSERT OR UPDATE OF rating, total_reviews
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_rating_on_product_change();

-- Initialize vendor ratings for existing vendors
UPDATE vendors v
SET rating = calculate_vendor_rating(v.user_id),
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM products p 
  WHERE p.vendor_id = v.user_id
);