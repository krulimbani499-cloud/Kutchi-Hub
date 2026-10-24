-- Revert of 01_migration.sql: back to the guard function from supabase/pending/edit-requires-plan (no owner_id lock in the trigger;
-- the row-level policy still stops owners changing owner_id).
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_business_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.verified := false;
    NEW.current_plan_id := NULL;
    NEW.plan_tier_order := 0;
    NEW.plan_featured := false;
    NEW.plan_top_ranking := false;
    RETURN NEW;
  END IF;

  IF NEW.status          IS DISTINCT FROM OLD.status
  OR NEW.verified        IS DISTINCT FROM OLD.verified
  OR NEW.current_plan_id IS DISTINCT FROM OLD.current_plan_id
  OR NEW.plan_tier_order IS DISTINCT FROM OLD.plan_tier_order
  OR NEW.plan_featured   IS DISTINCT FROM OLD.plan_featured
  OR NEW.plan_top_ranking IS DISTINCT FROM OLD.plan_top_ranking THEN
    RAISE EXCEPTION 'Only an admin can change the status, verification or plan of a business'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
