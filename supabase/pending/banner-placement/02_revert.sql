-- Revert of 01_migration.sql. Banners keep working (the app falls back to "everything is a top banner").
-- Any banner that was set to 'home_middle' or 'show all cities' loses that setting.
BEGIN;
DROP INDEX IF EXISTS public.banner_ads_placement_idx;
ALTER TABLE public.banner_ads DROP CONSTRAINT IF EXISTS banner_ads_placement_check;
ALTER TABLE public.banner_ads DROP COLUMN IF EXISTS show_all_cities;
ALTER TABLE public.banner_ads DROP COLUMN IF EXISTS placement;
COMMIT;
