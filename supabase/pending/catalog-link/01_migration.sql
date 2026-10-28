-- ============================================================================
-- CATALOG LINK: a business can add a link to its catalog (Google Drive, a website page, ...) next to, or instead of, the PDF.
-- A product can have its own optional link too.
--
--   businesses.catalog_link        text, nullable   (https:// only)
--   business_products.link_url     text, nullable   (https:// only)
--
-- PLAN RULE (business catalog link): the same as the PDF catalog. guard_business_catalog() (created by catalog-gold-only) is
-- extended so that a non-admin can set catalog_link to a value only when business_can_use_catalog() is true (an active plan
-- whose allow_catalog is true: Gold and above, not Silver).
--   - Clearing it (NULL) is always allowed.
--   - Unchanged values are never touched, so a Silver business that already has a link can still save other edits, and nothing
--     is deleted.
--   - A brand-new business cannot start with a link (INSERT forces it to NULL, exactly as for catalog_url / catalog_name).
--   - Admins, and writes with no end-user JWT (service role, SQL editor), are never restricted.
-- The product link has NO plan rule (it belongs to the product, like its description). Owners edit it under the same row rules as
-- the rest of the product (edit-requires-plan).
--
-- ONLY https:// : both columns get a CHECK, so even a request that skips the app cannot store javascript:, data:, http:, ftp:
-- or a link with spaces / no host. (The app checks the same thing first and shows a readable message.)
--
-- APPLY ORDER: AFTER supabase/pending/catalog-gold-only (it creates guard_business_catalog and business_can_use_catalog; this file
-- refuses otherwise and changes nothing). Independent of section-toggles.
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- The app works without this file: the link fields can be filled in, but saving a link says the database update is missing.
-- ============================================================================
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.guard_business_catalog()') IS NULL OR to_regprocedure('public.business_can_use_catalog(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Apply supabase/pending/catalog-gold-only first (guard_business_catalog / business_can_use_catalog are missing). Nothing was changed.';
  END IF;
END
$$;

-- 1. columns
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS catalog_link text;
ALTER TABLE public.business_products ADD COLUMN IF NOT EXISTS link_url text;

-- 2. https:// only, no spaces, a host after it, at most 500 characters
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_catalog_link_https;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_catalog_link_https
  CHECK (catalog_link IS NULL OR (catalog_link ~* '^https://[^[:space:]/?#]+[^[:space:]]*$' AND length(catalog_link) <= 500));

ALTER TABLE public.business_products DROP CONSTRAINT IF EXISTS business_products_link_url_https;
ALTER TABLE public.business_products
  ADD CONSTRAINT business_products_link_url_https
  CHECK (link_url IS NULL OR (link_url ~* '^https://[^[:space:]/?#]+[^[:space:]]*$' AND length(link_url) <= 500));

-- 3. the catalog plan rule now covers the link as well (same trigger, same error, new wording)
CREATE OR REPLACE FUNCTION public.guard_business_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No end-user JWT (service role, SQL editor, cron) or an admin: allowed.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A brand-new business has no plan yet, so it cannot start with a catalog or a catalog link.
    NEW.catalog_url := NULL;
    NEW.catalog_name := NULL;
    NEW.catalog_link := NULL;
    RETURN NEW;
  END IF;

  IF (
       ((NEW.catalog_url  IS DISTINCT FROM OLD.catalog_url
         OR NEW.catalog_name IS DISTINCT FROM OLD.catalog_name)
        AND (NEW.catalog_url IS NOT NULL OR NEW.catalog_name IS NOT NULL))   -- clearing is always allowed
       OR
       (NEW.catalog_link IS DISTINCT FROM OLD.catalog_link AND NEW.catalog_link IS NOT NULL)
     )
     AND NOT public.business_can_use_catalog(NEW.id) THEN
    RAISE EXCEPTION 'Product catalog (PDF or link) is available on Gold and Platinum plans'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- The trigger itself already exists (catalog-gold-only) and keeps pointing at the same function name.
DROP TRIGGER IF EXISTS businesses_guard_catalog ON public.businesses;
CREATE TRIGGER businesses_guard_catalog
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_catalog();

COMMIT;
