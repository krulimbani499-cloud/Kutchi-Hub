-- ============================================================================
-- REVERT of 01_migration.sql: restores the policies exactly as the repo's migrations define them
-- (supabase/migrations 20260701044723, 20260707045837, 20260707055139, 20260710160628) and removes
-- the helper function and the column-guard trigger.
-- If your live policies differed from the migrations, restore from the output of 03_verify.sql (b)
-- that you saved before applying.
-- business_has_active_plan() is NOT dropped: supabase/pending/active-plan-rule may use it.
-- ============================================================================
BEGIN;

-- 6. column guard
DROP TRIGGER IF EXISTS businesses_guard_admin_columns ON public.businesses;
DROP FUNCTION IF EXISTS public.guard_business_admin_columns();

-- 5. storage (original: owner of the business folder, or admin)
DROP POLICY IF EXISTS "Owners insert business photos" ON storage.objects;
CREATE POLICY "Owners insert business photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
          AND b.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owners update business photos" ON storage.objects;
CREATE POLICY "Owners update business photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
          AND b.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owners delete business photos" ON storage.objects;
CREATE POLICY "Owners delete business photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
          AND b.owner_id = auth.uid()
      )
    )
  );

-- 4. child tables
DROP POLICY IF EXISTS "Owner can manage services" ON public.business_services;
CREATE POLICY "Owner can manage services"
  ON public.business_services FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner can manage products" ON public.business_products;
CREATE POLICY "Owner can manage products"
  ON public.business_products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_products.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_products.business_id AND b.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can manage photos" ON public.business_photos;
CREATE POLICY "Business owners can manage photos"
  ON public.business_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_photos.business_id
        AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_photos.business_id
        AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- 3. businesses
DROP POLICY IF EXISTS "Owners can update their own businesses" ON public.businesses;
CREATE POLICY "Owners can update their own businesses"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. helper (nothing references it any more)
DROP FUNCTION IF EXISTS public.business_owner_can_edit(uuid);

COMMIT;
