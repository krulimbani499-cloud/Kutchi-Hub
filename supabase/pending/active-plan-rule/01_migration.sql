-- ============================================================================
-- RULE: a business is publicly visible ONLY IF
--         (a) businesses.status = 'published'            (admin approved)  AND
--         (b) it has an active row in business_subscriptions (admin assigned a plan)
--       Owners always see their own business; admins see everything.
--
-- "Active subscription" = status = 'active'
--                         AND started_at <= now()
--                         AND (expires_at IS NULL OR expires_at > now())
-- Evaluated at READ time, so an expired plan hides the business without any
-- cron job. The plan itself is NOT inspected: any plan row counts, including a
-- plan that has since been deactivated (is_active = false). There is no Free plan.
--
-- STATUS: NOT APPLIED. Do not run until the 11 businesses without a plan have
-- either been given a subscription or deliberately left hidden.
-- Revert: 02_revert.sql        Verify: 03_verify.sql / 04_verify_public.mjs
-- ============================================================================
BEGIN;

-- 1. Does this business have an active subscription right now?
CREATE OR REPLACE FUNCTION public.business_has_active_plan(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_subscriptions s
    WHERE s.business_id = _business_id
      AND s.status = 'active'
      AND s.started_at <= now()
      AND (s.expires_at IS NULL OR s.expires_at > now())
  )
$$;

-- 2. Is this business live for the general public? (approved AND has a plan)
CREATE OR REPLACE FUNCTION public.business_is_live(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = _business_id
      AND b.status = 'published'
      AND public.business_has_active_plan(b.id)
  )
$$;

GRANT EXECUTE ON FUNCTION public.business_has_active_plan(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_is_live(uuid) TO anon, authenticated;

-- 3. The existing central predicate (used by photos / products / services /
--    reviews policies) now means "live OR owner OR admin".
CREATE OR REPLACE FUNCTION public.business_visible_to_caller(_business_id uuid)
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
        (b.status = 'published' AND public.business_has_active_plan(b.id))
        OR b.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
  )
$$;

-- 4. businesses: the two SELECT policies. Admin and owner clauses are kept, so
--    the admin panel and "My businesses" are unaffected.
DROP POLICY IF EXISTS "Published businesses are public" ON public.businesses;
CREATE POLICY "Published businesses are public"
  ON public.businesses FOR SELECT
  TO anon
  USING (status = 'published' AND public.business_has_active_plan(id));

DROP POLICY IF EXISTS "Authenticated users can view published businesses" ON public.businesses;
CREATE POLICY "Authenticated users can view published businesses"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (
    (status = 'published' AND public.business_has_active_plan(id))
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5. Banners: a banner tied to a business is shown only while that business is
--    live. Banners with no business (house / admin banners) are unchanged.
--    Owners and admins keep seeing their own banners through the existing
--    "Owners can view their banners" / "Admins can view all banners" policies.
DROP POLICY IF EXISTS "Public can view live banners" ON public.banner_ads;
CREATE POLICY "Public can view live banners"
  ON public.banner_ads FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND start_at <= now()
    AND (end_at IS NULL OR end_at > now())
    AND (business_id IS NULL OR public.business_is_live(business_id))
  );

-- 6. Lookup index for the subscription check.
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_active_lookup
  ON public.business_subscriptions (business_id, status, expires_at);

COMMIT;
