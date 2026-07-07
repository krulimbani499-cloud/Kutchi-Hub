
-- 1. Restrict profiles: remove public anon SELECT (protects emails stored in display_name)
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

-- Authenticated users can still view basic profile info of others (needed for reviews UI)
CREATE POLICY "Authenticated can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 2. Categories: only admins can insert (matches update/delete policies)
DROP POLICY IF EXISTS "Authenticated users can create categories" ON public.categories;
CREATE POLICY "Admins can create categories"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. business_reviews: prevent business owner from editing reviewer-controlled fields.
-- Trigger restricts owner-side updates to owner_reply / owner_reply_at only.
CREATE OR REPLACE FUNCTION public.enforce_review_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the row author is updating, allow any change.
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Otherwise (business owner replying), only owner_reply/owner_reply_at may change.
  IF NEW.rating       IS DISTINCT FROM OLD.rating       OR
     NEW.review       IS DISTINCT FROM OLD.review       OR
     NEW.user_id      IS DISTINCT FROM OLD.user_id      OR
     NEW.business_id  IS DISTINCT FROM OLD.business_id  OR
     NEW.helpful_count IS DISTINCT FROM OLD.helpful_count OR
     NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Business owners may only edit owner_reply fields on reviews';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_review_update_columns_trg ON public.business_reviews;
CREATE TRIGGER enforce_review_update_columns_trg
BEFORE UPDATE ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_update_columns();

-- 4. Tighten "always true" INSERT policies by requiring an existing business row.
DROP POLICY IF EXISTS "Anyone can create enquiry" ON public.business_enquiries;
CREATE POLICY "Anyone can create enquiry"
ON public.business_enquiries FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id));

DROP POLICY IF EXISTS "Anyone can log events" ON public.business_events;
CREATE POLICY "Anyone can log events"
ON public.business_events FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id));
