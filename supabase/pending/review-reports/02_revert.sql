-- ============================================================================
-- REVERT of review-reports/01_migration.sql. NOT APPLIED.
-- Puts the original business_reviews SELECT policy back (hidden reviews show again) and drops the three new tables
-- (all reports, hidden-review marks and user blocks are lost) and the helper function.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "Reviews visible for published or owned businesses" ON public.business_reviews;
CREATE POLICY "Reviews visible for published or owned businesses"
  ON public.business_reviews FOR SELECT
  USING (public.business_visible_to_caller(business_id));

DROP FUNCTION IF EXISTS public.review_visible_to_caller(uuid, uuid);
DROP TABLE IF EXISTS public.review_user_blocks;
DROP TABLE IF EXISTS public.review_hidden;
DROP TABLE IF EXISTS public.review_reports;

COMMIT;
