-- ============================================================================
-- RULE: the product catalog (PDF) is a Gold / Platinum / Enterprise feature. Silver cannot use it.
--
-- APPLY ORDER: AFTER supabase/pending/edit-requires-plan/01_migration.sql. This file does not change
-- anything that file creates (it adds its own column, function, trigger and policies), so it cannot
-- break it, and 02_revert.sql here removes only what this file adds.
--
-- What it does
--   a) plans.allow_catalog boolean NOT NULL DEFAULT true; set to false for the Silver plan.
--      (New plans, and Gold / Platinum / Enterprise, keep the default: allowed.)
--   b) business_can_use_catalog(business_id): true only if the business has an ACTIVE subscription
--      (same rule as business_has_active_plan: status 'active', started, not expired) on a plan whose
--      allow_catalog is true.
--   c) A small separate BEFORE INSERT/UPDATE trigger on businesses: a non-admin may not set
--      catalog_url / catalog_name to a value unless business_can_use_catalog() is true. Clearing them
--      (NULL) is always allowed. Unchanged values are never touched, so a Silver business that already
--      has a catalog can still save other edits, and nothing is deleted.
--   d) Storage: a RESTRICTIVE policy, so uploading / renaming a .pdf into business-photos needs the
--      same permission. (Restrictive policies are AND-ed with the existing permissive ones, so the
--      edit-requires-plan storage policies are left exactly as they are.)
--
-- Why a separate trigger instead of extending guard_business_admin_columns():
--   that function (created by edit-requires-plan) guards status / verified / plan columns and raises a
--   different error. Keeping the catalog rule in its own function means the already-reviewed guard is
--   not redefined, the two can be reverted independently, and either file can be applied or reverted
--   without the other changing behaviour.
--
-- Admins, and writes with no end-user JWT (service role, SQL editor), are never restricted.
-- ============================================================================
BEGIN;

-- a) the flag
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS allow_catalog boolean NOT NULL DEFAULT true;

-- Exact row: the live Silver plan. Matched by id AND slug (slug is UNIQUE); the check below aborts the whole
-- migration if it does not match exactly one row (e.g. wrong environment) instead of silently doing nothing.
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.plans
     SET allow_catalog = false
   WHERE id   = '7f66fb32-db17-4cbc-bc2a-57f9e2f61754'
     AND slug = 'silver';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected to update exactly 1 Silver plan row, updated % - nothing applied', n;
  END IF;
END
$$;

-- b) may this business use the catalog right now?
CREATE OR REPLACE FUNCTION public.business_can_use_catalog(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.business_id = _business_id
      AND s.status = 'active'
      AND s.started_at <= now()
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND p.allow_catalog = true
  )
$$;
-- anon too: the public business page asks whether to show the catalog.
GRANT EXECUTE ON FUNCTION public.business_can_use_catalog(uuid) TO anon, authenticated;

-- c) column guard
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

DROP TRIGGER IF EXISTS businesses_guard_catalog ON public.businesses;
CREATE TRIGGER businesses_guard_catalog
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_catalog();

-- d) storage: .pdf files in the business-photos bucket (catalogs are stored as <business_id>/catalog-<uuid>.pdf)
--    RESTRICTIVE = must ALSO pass, on top of the existing owner / admin policies.
--    Everything that is not a .pdf, in any bucket, passes straight through. Admins always pass.
--    Limits: this is a file-name check (a PDF uploaded under another extension is not caught here), but such
--    a file cannot be attached as the catalog because of the trigger above.
DROP POLICY IF EXISTS "Catalog PDFs need a catalog plan (insert)" ON storage.objects;
CREATE POLICY "Catalog PDFs need a catalog plan (insert)"
  ON storage.objects AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT (bucket_id = 'business-photos' AND lower(name) LIKE '%.pdf')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
        AND b.owner_id = auth.uid()
        AND public.business_can_use_catalog(b.id)
    )
  );

-- also on UPDATE, so an uploaded image cannot simply be renamed to .pdf
DROP POLICY IF EXISTS "Catalog PDFs need a catalog plan (update)" ON storage.objects;
CREATE POLICY "Catalog PDFs need a catalog plan (update)"
  ON storage.objects AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    NOT (bucket_id = 'business-photos' AND lower(name) LIKE '%.pdf')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
        AND b.owner_id = auth.uid()
        AND public.business_can_use_catalog(b.id)
    )
  );

COMMIT;
