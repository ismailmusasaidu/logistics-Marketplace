/*
  # Fix Review Trigger Security
  
  ## Overview
  This migration fixes the review rating trigger to run with elevated privileges
  so it can update the products table even when called by regular users.
  
  ## Changes
  - Recreate the update_product_rating function with SECURITY DEFINER
  - This allows the trigger to bypass RLS policies when updating product ratings
*/

-- Drop and recreate the function with SECURITY DEFINER
DROP FUNCTION IF EXISTS update_product_rating() CASCADE;

CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE products
    SET 
      rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = OLD.product_id), 0),
      total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = OLD.product_id)
    WHERE id = OLD.product_id;
    RETURN OLD;
  ELSE
    UPDATE products
    SET 
      rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = NEW.product_id), 0),
      total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
DROP TRIGGER IF EXISTS update_rating_after_review_insert ON reviews;
CREATE TRIGGER update_rating_after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

DROP TRIGGER IF EXISTS update_rating_after_review_update ON reviews;
CREATE TRIGGER update_rating_after_review_update
AFTER UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

DROP TRIGGER IF EXISTS update_rating_after_review_delete ON reviews;
CREATE TRIGGER update_rating_after_review_delete
AFTER DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();
