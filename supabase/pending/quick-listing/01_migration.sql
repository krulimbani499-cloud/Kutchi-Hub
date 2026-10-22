-- ============================================================================
-- QUICK LISTING: a new owner leaves 4 things (business name, contact person, phone, city) and the Kutchi Hub team
-- calls them. The business is created as status 'pending' with nothing invented for the fields we did not ask for.
--
--   businesses.contact_name   text, nullable. The person to call.
--   businesses.quick_lead     boolean NOT NULL DEFAULT false. true = created through the quick form. Every existing
--                             business is false, so nothing about them changes.
--   businesses.category_id    becomes NULLABLE (the quick form makes the category optional). The foreign key stays.
--                             This is the only NOT NULL column the quick form does not fill (name, slug, status are
--                             always set). An admin is warned before publishing a business with no category.
--   business_owner_can_edit() a quick lead is locked for its OWNER until a plan is active (the app shows
--                             "Waiting for activation"). Everything else is exactly as before:
--                                 before : status <> 'published'  OR  active plan
--                                 after  : active plan  OR  (status <> 'published'  AND  NOT quick_lead)
--                             so a normal pending business (the 25 current ones) can still be edited by its owner.
--                             Admins are not affected (they are handled in each policy, not here).
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- Until this runs the app keeps the old full "List your business" form for everyone (it checks that the quick_lead
-- column exists), so it is safe to deploy the code first.
-- Needs supabase/pending/edit-requires-plan to be applied already (it defines business_has_active_plan and
-- business_owner_can_edit); this file refuses to run otherwise, instead of guessing.
-- ============================================================================
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.business_has_active_plan(uuid)') IS NULL
     OR to_regprocedure('public.business_owner_can_edit(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Apply supabase/pending/edit-requires-plan first (business_has_active_plan / business_owner_can_edit are missing). Nothing was changed.';
  END IF;
END
$$;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS quick_lead boolean NOT NULL DEFAULT false;

-- The quick form does not ask for a category.
ALTER TABLE public.businesses ALTER COLUMN category_id DROP NOT NULL;

-- Quick leads stay locked for the owner until a plan is active.
CREATE OR REPLACE FUNCTION public.business_owner_can_edit(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = _business_id
      AND (
        public.business_has_active_plan(b.id)
        OR (b.status <> 'published' AND NOT b.quick_lead)
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.business_owner_can_edit(uuid) TO anon, authenticated;

COMMIT;
