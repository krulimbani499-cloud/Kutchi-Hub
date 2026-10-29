-- Revert of 01_migration.sql: removes the column (and the keywords admins typed: they are not stored anywhere else).
-- After this the landing pages use the category name only, exactly as before.
BEGIN;

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_seo_keywords_len;
ALTER TABLE public.categories DROP COLUMN IF EXISTS seo_keywords;

COMMIT;
