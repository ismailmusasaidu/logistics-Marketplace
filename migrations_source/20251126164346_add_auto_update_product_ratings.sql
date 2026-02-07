/*
  # Auto-update Product Ratings

  ## Overview
  This migration adds a database trigger that automatically updates a product's average rating 
  and total review count whenever a review is added, updated, or deleted.

  ## Changes Made
  
  ### 1. Functions Created
    - `update_product_rating()` - Trigger function that:
      - Calculates average rating from all reviews for a product
      - Counts total number of reviews
      - Updates the product record with new values
      - Handles INSERT, UPDATE, and DELETE operations
  
  ### 2. Triggers Created
    - `update_rating_after_review_insert` - Fires after review INSERT
    - `update_rating_after_review_update` - Fires after review UPDATE
    - `update_rating_after_review_delete` - Fires after review DELETE
  
  ## Notes
  - Uses COALESCE to handle cases where no reviews exist (sets rating to 0)
  - Separate triggers for each operation type for better control
  - Automatically maintains data integrity between reviews and products tables
*/

-- Function to update product rating and review count
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
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

-- Trigger after INSERT
DROP TRIGGER IF EXISTS update_rating_after_review_insert ON reviews;
CREATE TRIGGER update_rating_after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- Trigger after UPDATE
DROP TRIGGER IF EXISTS update_rating_after_review_update ON reviews;
CREATE TRIGGER update_rating_after_review_update
AFTER UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- Trigger after DELETE
DROP TRIGGER IF EXISTS update_rating_after_review_delete ON reviews;
CREATE TRIGGER update_rating_after_review_delete
AFTER DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();
