/*
  # Fix carts unique constraint to include variant columns

  ## Problem
  The existing unique constraint on carts is (user_id, product_id) only.
  This causes a duplicate key error when the same product is added with
  different size, color, or pricing option variants.

  ## Change
  - Drop the old unique constraint
  - Add a new unique constraint covering (user_id, product_id, selected_size, selected_color, selected_option)
  - NULL values are treated as distinct in standard SQL but PostgreSQL treats them
    as equal in unique indexes, so we use COALESCE to normalize NULLs to empty string
    via a unique index with expressions.

  ## Notes
  - Using a partial expression-based index is the correct approach for nullable columns
  - Existing data is preserved
*/

ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_user_id_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS carts_user_id_product_id_variants_key
  ON carts (
    user_id,
    product_id,
    COALESCE(selected_size, ''),
    COALESCE(selected_color, ''),
    COALESCE(selected_option, '')
  );
