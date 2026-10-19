-- ============================================================================
-- HOMEPAGE BANNERS: a second (middle) slot, and "show in all cities" for Enterprise businesses.
--
--   banner_ads.placement        'home_top' (the banner under the search box, as today) or 'home_middle'
--                               (between Popular Categories and Nearby). Every existing banner stays 'home_top'.
--   banner_ads.show_all_cities  true = also shown in every OTHER city, in the middle slot only.
--                               Allowed only for a business with an ACTIVE Enterprise plan: the app checks this when
--                               the banner is saved, and again on every page view, so an expired Enterprise plan
--                               stops the banner outside its own city without anyone touching it.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- Safe to run before OR after deploying the code: until this runs, the app treats every banner as a top banner
-- (the middle slot stays empty and "show in all cities" cannot be saved). No RLS / GRANT change is needed:
-- banner_ads already has table-level SELECT for anon and full rights for authenticated, with row-level policies.
-- Existing rows get the defaults, so nothing visible changes when this runs.
-- ============================================================================
BEGIN;

ALTER TABLE public.banner_ads
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'home_top',
  ADD COLUMN IF NOT EXISTS show_all_cities boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.banner_ads'::regclass AND conname = 'banner_ads_placement_check'
  ) THEN
    ALTER TABLE public.banner_ads
      ADD CONSTRAINT banner_ads_placement_check CHECK (placement IN ('home_top', 'home_middle'));
  END IF;
END
$$;

-- The home page reads: active banners of one city + placement, best priority first.
CREATE INDEX IF NOT EXISTS banner_ads_placement_idx
  ON public.banner_ads (placement, active, priority DESC);

COMMIT;
