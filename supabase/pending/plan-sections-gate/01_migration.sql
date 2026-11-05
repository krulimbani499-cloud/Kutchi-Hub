-- ============================================================================
-- PLAN SECTIONS GATE: a plan whose limit for Services / Products is 0 (Silver) may not CHANGE them either.
--
-- WHAT EXISTS: enforce_business_plan_limit() (migration 20260714103922) already refuses a NEW service / product / photo when the plan's
-- limit is reached; with max_services / max_products = 0 (Silver) that means no new rows. What it does NOT cover is an UPDATE of a row
-- that already exists (3 Silver businesses have a few saved, see the report). The site's server functions now refuse such a save
-- (src/lib/plan-features.server.ts); this makes the database say the same thing for anyone who calls the API directly.
--
-- WHAT IT DOES: two BEFORE UPDATE triggers (business_services, business_products). For a non-admin, if the business's plan limit for
-- that section is 0, the update is refused - EXCEPT an update that leaves the row switched OFF (active = false): hiding stays possible.
-- Same rule as the insert trigger: limit = the plan's max_services / max_products, no plan = 3, negative = unlimited, 0 = none.
-- Admins, and writes with no end-user JWT (service role, SQL editor), are never restricted. DELETE is not touched (removing is fine).
-- Nothing is changed in existing rows. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run.
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_plan_section_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind  text := TG_ARGV[0];          -- 'products' | 'services'
  v_limit integer;
BEGIN
  -- no end-user (service role / SQL editor) and admins: never restricted
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- switching a row OFF is always allowed
  IF NEW.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT CASE v_kind WHEN 'products' THEN p.max_products WHEN 'services' THEN p.max_services END
    INTO v_limit
    FROM public.businesses b
    LEFT JOIN public.plans p ON p.id = b.current_plan_id
   WHERE b.id = NEW.business_id;

  IF v_limit IS NULL THEN
    v_limit := 3;                      -- free defaults, as in enforce_business_plan_limit()
  END IF;

  IF v_limit = 0 THEN
    RAISE EXCEPTION 'Plan limit reached — your plan allows only 0 %. Upgrade to add more.', v_kind
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_service_plan_update ON public.business_services;
CREATE TRIGGER enforce_service_plan_update
BEFORE UPDATE ON public.business_services
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_section_update('services');

DROP TRIGGER IF EXISTS enforce_product_plan_update ON public.business_products;
CREATE TRIGGER enforce_product_plan_update
BEFORE UPDATE ON public.business_products
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_section_update('products');

COMMIT;
