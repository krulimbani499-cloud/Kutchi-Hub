
-- 1. Business Enquiries (Leads)
CREATE TABLE public.business_enquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  message text,
  service_needed text,
  city text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed','spam')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_enquiries_business ON public.business_enquiries(business_id, created_at DESC);
CREATE INDEX idx_enquiries_user ON public.business_enquiries(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_enquiries TO authenticated;
GRANT INSERT ON public.business_enquiries TO anon;
GRANT ALL ON public.business_enquiries TO service_role;
ALTER TABLE public.business_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create enquiry" ON public.business_enquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owner can view business enquiries" ON public.business_enquiries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );
CREATE POLICY "User can view own enquiries" ON public.business_enquiries
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin can view all enquiries" ON public.business_enquiries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner can update enquiry status" ON public.business_enquiries
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );
CREATE POLICY "Admin can update any enquiry" ON public.business_enquiries
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_business_enquiries_updated_at BEFORE UPDATE ON public.business_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Business Services
CREATE TABLE public.business_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2),
  price_unit text CHECK (price_unit IN ('fixed','starts_at','per_hour','per_day','per_visit','per_item')),
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_business ON public.business_services(business_id, display_order);
GRANT SELECT ON public.business_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_services TO authenticated;
GRANT ALL ON public.business_services TO service_role;
ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services are public" ON public.business_services
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner can manage services" ON public.business_services
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );
CREATE POLICY "Admin can manage services" ON public.business_services
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_business_services_updated_at BEFORE UPDATE ON public.business_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Business Events (Analytics)
CREATE TABLE public.business_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view','call_click','whatsapp_click','website_click','direction_click','share_click','enquiry_submit')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_business_time ON public.business_events(business_id, created_at DESC);
CREATE INDEX idx_events_type_time ON public.business_events(event_type, created_at DESC);
GRANT INSERT ON public.business_events TO anon, authenticated;
GRANT SELECT ON public.business_events TO authenticated;
GRANT ALL ON public.business_events TO service_role;
ALTER TABLE public.business_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log events" ON public.business_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owner can view own business events" ON public.business_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );
CREATE POLICY "Admin can view all events" ON public.business_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- 4. Review replies on business_reviews
ALTER TABLE public.business_reviews
  ADD COLUMN IF NOT EXISTS owner_reply text,
  ADD COLUMN IF NOT EXISTS owner_reply_at timestamptz;

CREATE POLICY "Owner can reply to review" ON public.business_reviews
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );


-- 5. Notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link_url text,
  entity_type text,
  entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_time ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_user_unread ON public.notifications(user_id) WHERE read = false;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "User can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 6. Reports
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('business','review','photo','enquiry')),
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_entity ON public.reports(entity_type, entity_id);
CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can create report" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Reporter can view own report" ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "Admin can view all reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update reports" ON public.reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 7. Notification triggers

-- Notify business owner on new review
CREATE OR REPLACE FUNCTION public.notify_owner_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_name text;
  v_slug text;
BEGIN
  SELECT owner_id, name, slug INTO v_owner, v_name, v_slug FROM public.businesses WHERE id = NEW.business_id;
  IF v_owner IS NOT NULL AND v_owner <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_url, entity_type, entity_id)
    VALUES (v_owner, 'new_review',
      'New review on ' || v_name,
      COALESCE(NEW.rating::text, '') || '★ — ' || COALESCE(LEFT(NEW.comment, 120), ''),
      '/business/' || v_slug,
      'review', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_owner_on_review AFTER INSERT ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_review();

-- Notify business owner on new enquiry
CREATE OR REPLACE FUNCTION public.notify_owner_on_enquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_name text;
  v_slug text;
BEGIN
  SELECT owner_id, name, slug INTO v_owner, v_name, v_slug FROM public.businesses WHERE id = NEW.business_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_url, entity_type, entity_id)
    VALUES (v_owner, 'new_enquiry',
      'New enquiry for ' || v_name,
      NEW.name || ' (' || NEW.phone || ')' || COALESCE(' — ' || LEFT(NEW.message, 100), ''),
      '/dashboard',
      'enquiry', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_owner_on_enquiry AFTER INSERT ON public.business_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_enquiry();

-- Notify claimant on claim status change
CREATE OR REPLACE FUNCTION public.notify_claimant_on_claim_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_slug text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name, slug INTO v_name, v_slug FROM public.businesses WHERE id = NEW.business_id;
    INSERT INTO public.notifications (user_id, type, title, body, link_url, entity_type, entity_id)
    VALUES (NEW.claimant_id, 'claim_' || NEW.status,
      'Claim ' || NEW.status || ' — ' || COALESCE(v_name, ''),
      'Your business claim has been ' || NEW.status,
      '/business/' || v_slug,
      'claim', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_claimant_on_claim_update AFTER UPDATE ON public.business_claims
  FOR EACH ROW EXECUTE FUNCTION public.notify_claimant_on_claim_update();
