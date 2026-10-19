-- ============================================================================
-- ONE BUSINESS PER SLUG.
-- The page address is /business/<slug>, so two businesses with the same slug break that page and the edit page
-- ("JSON object requested, multiple rows"). Today only (slug, city) is unique, so the same slug can exist in two cities.
-- This adds a UNIQUE index on businesses(slug). The app already picks slug-2, slug-3, ... for new / renamed businesses.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run.
-- Run 01_check.sql first. If it lists any slug, rename the extra business(es), for example:
--     UPDATE public.businesses SET slug = 'maruti-enterprise-2' WHERE id = '<the id from 01_check.sql>';
-- and run this file again. Revert: 03_revert.sql.
--
-- Fails safely: if a duplicate still exists nothing is created and the message names the slugs.
-- ============================================================================
BEGIN;

DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(slug || ' (' || n || ' businesses)', ', ' ORDER BY slug)
    INTO dupes
    FROM (SELECT slug, count(*) AS n FROM public.businesses GROUP BY slug HAVING count(*) > 1) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot make business slugs unique yet. These slugs are used by more than one business: %. Rename the extra ones (see 01_check.sql), then run this again. Nothing was changed.', dupes
      USING ERRCODE = 'unique_violation';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_slug_unique ON public.businesses (slug);

COMMIT;
