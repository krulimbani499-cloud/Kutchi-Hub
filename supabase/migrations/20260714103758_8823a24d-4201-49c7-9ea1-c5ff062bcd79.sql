
-- 1. Cache column on businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS current_plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_current_plan ON public.businesses(current_plan_id);

-- 2. Trigger function: recompute current_plan_id whenever subscriptions change
CREATE OR REPLACE FUNCTION public.sync_business_current_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_biz_id UUID;
  v_plan_id UUID;
  v_verified BOOLEAN;
BEGIN
  v_biz_id := COALESCE(NEW.business_id, OLD.business_id);

  SELECT bs.plan_id INTO v_plan_id
  FROM public.business_subscriptions bs
  WHERE bs.business_id = v_biz_id
    AND bs.status = 'active'
    AND (bs.expires_at IS NULL OR bs.expires_at > now())
  ORDER BY bs.started_at DESC
  LIMIT 1;

  SELECT COALESCE(p.verified_badge, false) INTO v_verified
  FROM public.plans p WHERE p.id = v_plan_id;

  UPDATE public.businesses
  SET current_plan_id = v_plan_id,
      verified = CASE WHEN COALESCE(v_verified, false) THEN true ELSE verified END
  WHERE id = v_biz_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_business_plan ON public.business_subscriptions;
CREATE TRIGGER trg_sync_business_plan
AFTER INSERT OR UPDATE OR DELETE ON public.business_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_business_current_plan();

-- 3. Backfill
UPDATE public.businesses b
SET current_plan_id = sub.plan_id
FROM (
  SELECT DISTINCT ON (bs.business_id) bs.business_id, bs.plan_id
  FROM public.business_subscriptions bs
  WHERE bs.status = 'active'
    AND (bs.expires_at IS NULL OR bs.expires_at > now())
  ORDER BY bs.business_id, bs.started_at DESC
) sub
WHERE b.id = sub.business_id;

-- 4. Helper: read plan perks/limits for a business (used by enforcement code)
CREATE OR REPLACE FUNCTION public.get_business_plan(_business_id UUID)
RETURNS TABLE(
  plan_id UUID,
  plan_slug TEXT,
  tier_order INTEGER,
  max_photos INTEGER,
  max_products INTEGER,
  max_services INTEGER,
  max_events INTEGER,
  featured_listing BOOLEAN,
  verified_badge BOOLEAN,
  top_ranking BOOLEAN,
  unlimited_leads BOOLEAN,
  priority_support BOOLEAN,
  analytics_access BOOLEAN,
  banner_ad_slots INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.slug, p.tier_order,
         p.max_photos, p.max_products, p.max_services, p.max_events,
         p.featured_listing, p.verified_badge, p.top_ranking, p.unlimited_leads,
         p.priority_support, p.analytics_access, p.banner_ad_slots
  FROM public.businesses b
  LEFT JOIN public.plans p ON p.id = b.current_plan_id
  WHERE b.id = _business_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_plan(UUID) TO authenticated, anon;
