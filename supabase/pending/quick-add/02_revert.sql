-- Revert of 01_migration.sql. Deletes the saved "source" of every lead (the businesses themselves are untouched).
BEGIN;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS lead_source;
COMMIT;
