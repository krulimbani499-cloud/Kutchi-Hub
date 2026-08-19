DROP POLICY "Owners can create their banners" ON public.banner_ads;
CREATE POLICY "Owners can create their banners" ON public.banner_ads FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() AND (business_id IS NULL OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())));

DROP POLICY "Owners can update their banners" ON public.banner_ads;
CREATE POLICY "Owners can update their banners" ON public.banner_ads FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid() AND (business_id IS NULL OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())));