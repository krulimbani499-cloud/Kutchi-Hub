
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan_tier_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_top_ranking BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_businesses_plan_tier ON public.businesses(plan_tier_order DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_plan_featured ON public.businesses(plan_featured) WHERE plan_featured = true;

-- Refresh the sync function to also update tier/featured/top-ranking flags
CREATE OR REPLACE FUNCTION public.sync_business_current_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_biz_id UUID;
  v_plan RECORD;
BEGIN
  v_biz_id := COALESCE(NEW.business_id, OLD.business_id);

  SELECT p.id, p.tier_order, p.verified_badge, p.featured_listing, p.top_ranking
    INTO v_plan
  FROM public.business_subscriptions bs
  JOIN public.plans p ON p.id = bs.plan_id
  WHERE bs.business_id = v_biz_id
    AND bs.status = 'active'
    AND (bs.expires_at IS NULL OR bs.expires_at > now())
  ORDER BY bs.started_at DESC
  LIMIT 1;

  UPDATE public.businesses
  SET current_plan_id  = v_plan.id,
      plan_tier_order  = COALESCE(v_plan.tier_order, 0),
      plan_featured    = COALESCE(v_plan.featured_listing, false),
      plan_top_ranking = COALESCE(v_plan.top_ranking, false),
      verified         = CASE WHEN COALESCE(v_plan.verified_badge, false) THEN true ELSE verified END
  WHERE id = v_biz_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill
UPDATE public.businesses b
SET plan_tier_order  = COALESCE(p.tier_order, 0),
    plan_featured    = COALESCE(p.featured_listing, false),
    plan_top_ranking = COALESCE(p.top_ranking, false)
FROM public.plans p
WHERE b.current_plan_id = p.id;
