-- Revert of 01_migration.sql.
-- Refuses to put NOT NULL back on category_id while a business has no category (those are quick leads: give them a
-- category, or delete them, first). Nothing is changed in that case.
BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.businesses WHERE category_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Cannot revert: % business(es) have no category yet (quick leads). Set a category or delete them first. Nothing was changed.', n;
  END IF;
END
$$;

-- The rule from supabase/pending/edit-requires-plan: not published, or an active plan.
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
      AND (b.status <> 'published' OR public.business_has_active_plan(b.id))
  )
$$;
GRANT EXECUTE ON FUNCTION public.business_owner_can_edit(uuid) TO anon, authenticated;

ALTER TABLE public.businesses ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS quick_lead;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS contact_name;

COMMIT;
