/*
  # Enhance Adverts Table — AliExpress-style Features

  ## Summary
  Adds rich promotional fields to the existing `adverts` table to support
  AliExpress-style promos: flash sales with countdown timers, discount pricing,
  coupon codes, advert type classification, and targeted display positions.

  ## Modified Table: adverts
  New columns:
  - `advert_type` (text) — 'promo' | 'flash_sale' | 'announcement' | 'coupon' | 'new_arrival' | 'featured_brand'
  - `countdown_end` (timestamptz, nullable) — flash sale end datetime for live countdown
  - `discount_percent` (integer, nullable) — e.g. 50 means 50% off badge
  - `original_price` (numeric, nullable) — crossed-out price
  - `promo_price` (numeric, nullable) — sale price
  - `coupon_code` (text, nullable) — copyable promo code e.g. "SAVE20"
  - `coupon_discount` (text, nullable) — coupon value label e.g. "₦500 OFF"
  - `display_position` (text) — 'banner' | 'modal' | 'both' (default 'both')
  - `bg_color_start` (text, nullable) — gradient start hex
  - `bg_color_end` (text, nullable) — gradient end hex
  - `terms_text` (text, nullable) — small print / T&C line

  ## Important Notes
  - All new columns are nullable or have safe defaults — no data loss
  - Existing adverts continue working unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='advert_type') THEN
    ALTER TABLE adverts ADD COLUMN advert_type text NOT NULL DEFAULT 'promo'
      CHECK (advert_type IN ('promo','flash_sale','announcement','coupon','new_arrival','featured_brand'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='countdown_end') THEN
    ALTER TABLE adverts ADD COLUMN countdown_end timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='discount_percent') THEN
    ALTER TABLE adverts ADD COLUMN discount_percent integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='original_price') THEN
    ALTER TABLE adverts ADD COLUMN original_price numeric(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='promo_price') THEN
    ALTER TABLE adverts ADD COLUMN promo_price numeric(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='coupon_code') THEN
    ALTER TABLE adverts ADD COLUMN coupon_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='coupon_discount') THEN
    ALTER TABLE adverts ADD COLUMN coupon_discount text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='display_position') THEN
    ALTER TABLE adverts ADD COLUMN display_position text NOT NULL DEFAULT 'both'
      CHECK (display_position IN ('banner','modal','both'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='bg_color_start') THEN
    ALTER TABLE adverts ADD COLUMN bg_color_start text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='bg_color_end') THEN
    ALTER TABLE adverts ADD COLUMN bg_color_end text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adverts' AND column_name='terms_text') THEN
    ALTER TABLE adverts ADD COLUMN terms_text text;
  END IF;
END $$;
