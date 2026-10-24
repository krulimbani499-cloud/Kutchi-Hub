-- ============================================================================
-- OWNER TRANSFER: only an admin may change businesses.owner_id.
--
-- Today the row-level policy "Owners can update their own businesses" already refuses an owner who tries to set owner_id to
-- anybody else (WITH CHECK needs owner_id = auth.uid() for a non-admin), so an owner cannot hand a business away or steal one.
-- This adds a second, independent lock in the existing guard trigger (guard_business_admin_columns, which already guards status,
-- verified and the plan columns), so the rule no longer depends on that one policy staying exactly as it is.
--
--   admin                         allowed (the "Assign owner" action in Admin -> Businesses)
--   no end-user JWT               allowed (service role / SQL editor), exactly as for the other guarded columns
--   anybody else, UPDATE          owner_id must stay as it is, otherwise: 42501 "Only an admin can change the owner of a business"
--   anybody else, INSERT          owner_id is forced to the person creating the row (nobody can create a business for someone else)
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- Needs supabase/pending/edit-requires-plan applied first (it creates the guard function and trigger); this file refuses otherwise.
-- The app works without this file (the policy above is enough); it only adds the extra lock.
-- ============================================================================
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.guard_business_admin_columns()') IS NULL THEN
    RAISE EXCEPTION 'Apply supabase/pending/edit-requires-plan first (guard_business_admin_columns is missing). Nothing was changed.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_business_admin_columns()
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
    -- A new business always starts unapproved, unverified and without plan perks, and belongs to whoever creates it.
    NEW.status := 'pending';
    NEW.verified := false;
    NEW.current_plan_id := NULL;
    NEW.plan_tier_order := 0;
    NEW.plan_featured := false;
    NEW.plan_top_ranking := false;
    NEW.owner_id := auth.uid();
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only an admin can change the owner of a business'
      USING ERRCODE = '42501';
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

-- The trigger itself already exists (edit-requires-plan); this only makes sure it is there and enabled.
DROP TRIGGER IF EXISTS businesses_guard_admin_columns ON public.businesses;
CREATE TRIGGER businesses_guard_admin_columns
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_admin_columns();

COMMIT;
