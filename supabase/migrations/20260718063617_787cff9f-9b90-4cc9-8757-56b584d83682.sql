
-- Helper: check if a business is publicly viewable by the current caller
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

GRANT EXECUTE ON FUNCTION public.business_visible_to_caller(uuid) TO anon, authenticated;

-- business_photos
DROP POLICY IF EXISTS "Photos are public" ON public.business_photos;
DROP POLICY IF EXISTS "Authenticated users can view photos" ON public.business_photos;
CREATE POLICY "Photos visible for published or owned businesses"
  ON public.business_photos FOR SELECT
  USING (public.business_visible_to_caller(business_id));

-- business_products
DROP POLICY IF EXISTS "Products are public" ON public.business_products;
CREATE POLICY "Products visible for published or owned businesses"
  ON public.business_products FOR SELECT
  USING (public.business_visible_to_caller(business_id));

-- business_services
DROP POLICY IF EXISTS "Services are public" ON public.business_services;
CREATE POLICY "Services visible for published or owned businesses"
  ON public.business_services FOR SELECT
  USING (public.business_visible_to_caller(business_id));

-- business_reviews
DROP POLICY IF EXISTS "Reviews are public" ON public.business_reviews;
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.business_reviews;
CREATE POLICY "Reviews visible for published or owned businesses"
  ON public.business_reviews FOR SELECT
  USING (public.business_visible_to_caller(business_id));
