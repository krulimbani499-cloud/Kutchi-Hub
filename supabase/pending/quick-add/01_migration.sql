-- ============================================================================
-- ADMIN "QUICK ADD" (collecting leads at an event / stall): where the lead came from.
--
--   businesses.lead_source   text, nullable. Free text such as an event name ("Kapadvanj Expo 2026"). Only the admin quick-add form
--                            writes it; every existing business keeps NULL, so nothing about them changes.
--
-- No RLS / GRANT change: the column is covered by the existing table-level privileges and row policies.
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- The app works before this runs: Quick add still saves the lead (just without the source) and says so in the toast.
-- Independent of quick-listing, but the Quick leads filter / CSV in the admin list need supabase/pending/quick-listing applied.
-- ============================================================================
BEGIN;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS lead_source text;
COMMIT;
