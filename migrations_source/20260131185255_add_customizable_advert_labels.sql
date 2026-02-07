/*
  # Add Customizable Labels to Adverts

  1. Changes
    - Add `hot_deal_text` column to adverts table (default: 'HOT DEAL')
    - Add `featured_text` column to adverts table (default: 'Featured')
    - Add `trending_text` column to adverts table (default: 'Trending Now')
    - Add `limited_offer_text` column to adverts table (default: 'Limited Time Offer')

  2. Notes
    - All fields are optional and have sensible defaults
    - Admin can customize these labels per advert for better targeting
*/

-- Add customizable label fields to adverts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'adverts' AND column_name = 'hot_deal_text'
  ) THEN
    ALTER TABLE adverts ADD COLUMN hot_deal_text text DEFAULT 'HOT DEAL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'adverts' AND column_name = 'featured_text'
  ) THEN
    ALTER TABLE adverts ADD COLUMN featured_text text DEFAULT 'Featured';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'adverts' AND column_name = 'trending_text'
  ) THEN
    ALTER TABLE adverts ADD COLUMN trending_text text DEFAULT 'Trending Now';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'adverts' AND column_name = 'limited_offer_text'
  ) THEN
    ALTER TABLE adverts ADD COLUMN limited_offer_text text DEFAULT 'Limited Time Offer';
  END IF;
END $$;