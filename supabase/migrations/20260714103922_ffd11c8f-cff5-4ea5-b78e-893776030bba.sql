
CREATE OR REPLACE FUNCTION public.enforce_business_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT := TG_ARGV[0];   -- 'photos' | 'products' | 'services'
  v_plan_limit INT;
  v_count INT;
  v_default INT;
  v_table TEXT;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Admin bypass (auth.uid() may be null for server triggers; that's fine)
  IF auth.uid() IS NOT NULL THEN
    SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
  END IF;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Resolve limit from the business's current plan
  SELECT CASE v_kind
           WHEN 'photos'   THEN p.max_photos
           WHEN 'products' THEN p.max_products
           WHEN 'services' THEN p.max_services
         END
    INTO v_plan_limit
  FROM public.businesses b
  LEFT JOIN public.plans p ON p.id = b.current_plan_id
  WHERE b.id = NEW.business_id;

  -- Free-tier defaults if no plan
  v_default := CASE v_kind WHEN 'photos' THEN 5 WHEN 'products' THEN 3 WHEN 'services' THEN 3 END;
  IF v_plan_limit IS NULL THEN v_plan_limit := v_default; END IF;

  -- -1 = unlimited
  IF v_plan_limit < 0 THEN RETURN NEW; END IF;

  v_table := CASE v_kind
    WHEN 'photos'   THEN 'business_photos'
    WHEN 'products' THEN 'business_products'
    WHEN 'services' THEN 'business_services'
  END;

  EXECUTE format('SELECT count(*) FROM public.%I WHERE business_id = $1', v_table)
    INTO v_count USING NEW.business_id;

  IF v_count >= v_plan_limit THEN
    RAISE EXCEPTION 'Plan limit reached — your plan allows only % %. Upgrade to add more.', v_plan_limit, v_kind
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_photo_plan_limit ON public.business_photos;
CREATE TRIGGER enforce_photo_plan_limit
BEFORE INSERT ON public.business_photos
FOR EACH ROW EXECUTE FUNCTION public.enforce_business_plan_limit('photos');

DROP TRIGGER IF EXISTS enforce_product_plan_limit ON public.business_products;
CREATE TRIGGER enforce_product_plan_limit
BEFORE INSERT ON public.business_products
FOR EACH ROW EXECUTE FUNCTION public.enforce_business_plan_limit('products');

DROP TRIGGER IF EXISTS enforce_service_plan_limit ON public.business_services;
CREATE TRIGGER enforce_service_plan_limit
BEFORE INSERT ON public.business_services
FOR EACH ROW EXECUTE FUNCTION public.enforce_business_plan_limit('services');
