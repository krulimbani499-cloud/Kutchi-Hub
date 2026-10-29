-- ============================================================================
-- CATEGORY SEO KEYWORDS: admin can give each category a few synonyms ("dealers, suppliers, wholesalers, near me") that the
-- city / category landing pages use in their intro and FAQ text (naturally, a few of them, never a keyword list).
--
--   public.categories.seo_keywords   text, nullable. Comma-separated words. NULL / empty = the pages use only the category name.
--                                    At most 300 characters (the app keeps 8 keywords of up to 30 characters each).
--
-- Nothing else changes: the existing policies already let everyone read categories and only admins change them, and a new
-- column is covered by them. No existing row is touched (every category starts with NULL).
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- Until this runs the app works as before: the pages use the category name only, and the admin box for keywords says the database
-- update is needed when someone tries to save keywords (saving the other category fields is not affected).
-- ============================================================================
BEGIN;

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS seo_keywords text;

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_seo_keywords_len;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_seo_keywords_len CHECK (seo_keywords IS NULL OR char_length(seo_keywords) <= 300);

COMMENT ON COLUMN public.categories.seo_keywords IS
  'Comma-separated synonyms used in the text of the city / category landing pages (e.g. "dealers, suppliers, near me").';

COMMIT;
