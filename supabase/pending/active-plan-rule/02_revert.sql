-- ============================================================================
-- REVERT of 01_migration.sql: restores the exact previous policies and
-- predicate (visibility = status 'published' only). Safe to run more than once.
-- ============================================================================
BEGIN;

-- businesses policies back to the originals
DROP POLICY IF EXISTS "Published businesses are public" ON public.businesses;
CREATE POLICY "Published businesses are public"
  ON public.businesses FOR SELECT
  TO anon
  USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated users can view published businesses" ON public.businesses;
CREATE POLICY "Authenticated users can view published businesses"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (status = 'published' OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- banner policy back to the original
DROP POLICY IF EXISTS "Public can view live banners" ON public.banner_ads;
CREATE POLICY "Public can view live banners"
  ON public.banner_ads FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND start_at <= now()
    AND (end_at IS NULL OR end_at > now())
  );

-- central predicate back to the original (migration 20260718063617)
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
        b.status = 'published'
        OR b.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
  )
$$;

-- drop the helpers added by 01_migration.sql (nothing references them any more)
DROP FUNCTION IF EXISTS public.business_is_live(uuid);
DROP FUNCTION IF EXISTS public.business_has_active_plan(uuid);
DROP INDEX IF EXISTS public.idx_business_subscriptions_active_lookup;

COMMIT;
