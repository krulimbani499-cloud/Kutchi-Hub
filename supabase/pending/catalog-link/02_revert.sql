-- Revert of 01_migration.sql. Order matters: the old trigger function goes back FIRST (the new one reads NEW.catalog_link, so it must
-- not outlive the column), then the constraints and the two columns are dropped. Saved links are lost (they are stored nowhere else).
-- The PDF catalog (catalog_url / catalog_name) and everything from catalog-gold-only stay exactly as they are.
BEGIN;

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
    -- A brand-new business has no plan yet, so it cannot start with a catalog.
    NEW.catalog_url := NULL;
    NEW.catalog_name := NULL;
    RETURN NEW;
  END IF;

  IF (NEW.catalog_url  IS DISTINCT FROM OLD.catalog_url
      OR NEW.catalog_name IS DISTINCT FROM OLD.catalog_name)
     AND (NEW.catalog_url IS NOT NULL OR NEW.catalog_name IS NOT NULL)   -- clearing is always allowed
     AND NOT public.business_can_use_catalog(NEW.id) THEN
    RAISE EXCEPTION 'Product catalog (PDF) is available on Gold and Platinum plans'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_catalog_link_https;
ALTER TABLE public.business_products DROP CONSTRAINT IF EXISTS business_products_link_url_https;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS catalog_link;
ALTER TABLE public.business_products DROP COLUMN IF EXISTS link_url;

COMMIT;
