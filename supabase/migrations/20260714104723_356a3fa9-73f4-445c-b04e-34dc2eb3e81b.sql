
CREATE OR REPLACE FUNCTION public.enforce_banner_ad_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slots INT;
  v_count INT;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Only enforce when the ad is tied to a specific business
  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
  END IF;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT p.banner_ad_slots INTO v_slots
  FROM public.businesses b
  LEFT JOIN public.plans p ON p.id = b.current_plan_id
  WHERE b.id = NEW.business_id;

  -- No plan = 0 slots (feature locked)
  IF v_slots IS NULL THEN v_slots := 0; END IF;

  -- -1 = unlimited
  IF v_slots < 0 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count
  FROM public.banner_ads
  WHERE business_id = NEW.business_id
    AND active = true
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_count >= v_slots AND COALESCE(NEW.active, true) THEN
    RAISE EXCEPTION 'Banner ad limit reached — this business''s plan allows only % active banner ad(s). Upgrade to add more.', v_slots
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_banner_ad_limit ON public.banner_ads;
CREATE TRIGGER enforce_banner_ad_limit
BEFORE INSERT OR UPDATE ON public.banner_ads
FOR EACH ROW EXECUTE FUNCTION public.enforce_banner_ad_plan_limit();
