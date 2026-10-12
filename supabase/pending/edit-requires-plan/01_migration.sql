-- ============================================================================
-- RULE: a business OWNER may edit the business (and everything the owner edit form writes)
--         - always while the business is NOT published (status 'pending' or 'rejected'), so the
--           first submission can be completed; and
--         - once it is published, only while it has an ACTIVE subscription.
--       Admins can always edit everything. Owners can still DELETE their business.
--
-- "Approved" = businesses.status = 'published' (values in use: pending / published / rejected).
-- "Active subscription" = status = 'active' AND started_at <= now() AND (expires_at IS NULL OR
--   expires_at > now()): the same rule as src/lib/subscription-utils.ts (isSubActive) and as
--   supabase/pending/active-plan-rule/01_migration.sql.
--
-- WHAT THE OWNER EDIT FORM WRITES (all covered below):
--   public.businesses          name, slug, category, description, address, city, state, pincode, phones,
--                              email, website, instagram/facebook/youtube, google_maps_url, hours (jsonb),
--                              app discount, featured_image, catalog_url, catalog_name
--   public.business_photos     owner photos (rows)
--   public.business_services   owner services
--   public.business_products   owner products (images are stored in the same bucket)
--   storage bucket business-photos   photos, product images and PDF catalogs, under "<business_id>/..."
--
-- NOT changed: SELECT policies, businesses INSERT policy (creating a business works as today),
-- businesses DELETE policy (owner can still delete), admin policies, reviews, favourites,
-- enquiries, banner_ads, subscriptions.
--
-- Run 03_verify.sql part (b) BEFORE applying and keep the output: it is the live policy list the
-- revert should restore (02_revert.sql restores what the repo's migrations define).
-- ============================================================================
BEGIN;

-- 1. Active-subscription check. IDENTICAL to the one in supabase/pending/active-plan-rule/01_migration.sql;
--    CREATE OR REPLACE makes it safe to apply either file first.
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
GRANT EXECUTE ON FUNCTION public.business_has_active_plan(uuid) TO anon, authenticated;

-- 2. May the OWNER edit this business right now?  (Admins are handled separately in each policy.)
--    true  = not published yet, OR published with an active plan.
--    false = published without an active plan, or the business does not exist.
CREATE OR REPLACE FUNCTION public.business_owner_can_edit(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = _business_id
      AND (b.status <> 'published' OR public.business_has_active_plan(b.id))
  )
$$;
-- anon too: some owner policies have no TO clause, so Postgres may evaluate them for anon.
GRANT EXECUTE ON FUNCTION public.business_owner_can_edit(uuid) TO anon, authenticated;

-- 3. businesses: owner UPDATE needs can_edit. Admin unchanged. INSERT / DELETE / SELECT untouched.
DROP POLICY IF EXISTS "Owners can update their own businesses" ON public.businesses;
CREATE POLICY "Owners can update their own businesses"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (owner_id = auth.uid() AND public.business_owner_can_edit(id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (owner_id = auth.uid() AND public.business_owner_can_edit(id))
  );

-- 4. Child tables (FOR ALL policies: their SELECT side is still covered by the separate
--    "...visible for published or owned businesses" SELECT policies, so owners keep seeing their data).
DROP POLICY IF EXISTS "Business owners can manage photos" ON public.business_photos;
CREATE POLICY "Business owners can manage photos"
  ON public.business_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_photos.business_id
        AND (public.has_role(auth.uid(), 'admin') OR (b.owner_id = auth.uid() AND public.business_owner_can_edit(b.id)))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_photos.business_id
        AND (public.has_role(auth.uid(), 'admin') OR (b.owner_id = auth.uid() AND public.business_owner_can_edit(b.id)))
    )
  );

DROP POLICY IF EXISTS "Owner can manage products" ON public.business_products;
CREATE POLICY "Owner can manage products"
  ON public.business_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_products.business_id AND b.owner_id = auth.uid() AND public.business_owner_can_edit(b.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_products.business_id AND b.owner_id = auth.uid() AND public.business_owner_can_edit(b.id)
    )
  );

DROP POLICY IF EXISTS "Owner can manage services" ON public.business_services;
CREATE POLICY "Owner can manage services"
  ON public.business_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid() AND public.business_owner_can_edit(b.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid() AND public.business_owner_can_edit(b.id)
    )
  );

-- 5. Storage: owner writes to the business-photos bucket (photos, product images, catalogs).
--    The first folder of every object name is the business id. Public read policy is untouched.
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
          AND public.business_owner_can_edit(b.id)
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
          AND public.business_owner_can_edit(b.id)
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
          AND public.business_owner_can_edit(b.id)
      )
    )
  );

-- 6. NEEDED FOR THE RULE TO HOLD (found while reading the policies):
--    the businesses UPDATE/INSERT policies have no column restrictions and nothing else protects these
--    columns, so today an owner can, with one direct API call, set status = 'published' (self-approve),
--    verified = true, or the cached plan columns (plan_tier_order, plan_featured, ...). That would also
--    defeat this rule (flip a locked business back to 'pending', edit it, flip it back).
--    This trigger lets only an admin (or a server/SQL-editor write with no end-user JWT) change them.
--    Normal flows are unaffected: the owner form never sends these columns; admin approve / verify /
--    assign-plan run as admin; the subscription sync trigger runs inside the admin's request.
CREATE OR REPLACE FUNCTION public.guard_business_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No end-user JWT (service role, SQL editor, cron) or an admin: allowed.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new business always starts unapproved, unverified and without plan perks.
    NEW.status := 'pending';
    NEW.verified := false;
    NEW.current_plan_id := NULL;
    NEW.plan_tier_order := 0;
    NEW.plan_featured := false;
    NEW.plan_top_ranking := false;
    RETURN NEW;
  END IF;

  IF NEW.status          IS DISTINCT FROM OLD.status
  OR NEW.verified        IS DISTINCT FROM OLD.verified
  OR NEW.current_plan_id IS DISTINCT FROM OLD.current_plan_id
  OR NEW.plan_tier_order IS DISTINCT FROM OLD.plan_tier_order
  OR NEW.plan_featured   IS DISTINCT FROM OLD.plan_featured
  OR NEW.plan_top_ranking IS DISTINCT FROM OLD.plan_top_ranking THEN
    RAISE EXCEPTION 'Only an admin can change the status, verification or plan of a business'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_guard_admin_columns ON public.businesses;
CREATE TRIGGER businesses_guard_admin_columns
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_admin_columns();

COMMIT;
