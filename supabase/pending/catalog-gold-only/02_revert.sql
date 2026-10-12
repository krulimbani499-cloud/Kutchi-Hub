-- ============================================================================
-- REVERT of 01_migration.sql. Removes exactly what that file added; it does not touch anything from
-- edit-requires-plan (guard_business_admin_columns, business_owner_can_edit and the owner policies stay).
-- NOTE: dropping plans.allow_catalog deletes the flag values (Silver = false). Re-running 01 sets them again.
-- The catalog files and businesses.catalog_url / catalog_name values are never touched by either file.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "Catalog PDFs need a catalog plan (update)" ON storage.objects;
DROP POLICY IF EXISTS "Catalog PDFs need a catalog plan (insert)" ON storage.objects;

DROP TRIGGER IF EXISTS businesses_guard_catalog ON public.businesses;
DROP FUNCTION IF EXISTS public.guard_business_catalog();
DROP FUNCTION IF EXISTS public.business_can_use_catalog(uuid);

ALTER TABLE public.plans DROP COLUMN IF EXISTS allow_catalog;

COMMIT;
