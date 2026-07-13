
-- PLANS TABLE
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tier_order INT NOT NULL DEFAULT 0,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  color TEXT DEFAULT '#ff6a00',
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  max_photos INT,
  max_products INT,
  max_services INT,
  max_events INT,
  featured_listing BOOLEAN NOT NULL DEFAULT false,
  verified_badge BOOLEAN NOT NULL DEFAULT false,
  top_ranking BOOLEAN NOT NULL DEFAULT false,
  unlimited_leads BOOLEAN NOT NULL DEFAULT false,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  analytics_access BOOLEAN NOT NULL DEFAULT false,
  banner_ad_slots INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_select_active" ON public.plans FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "plans_admin_insert" ON public.plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "plans_admin_update" ON public.plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "plans_admin_delete" ON public.plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AD SLOTS TABLE
CREATE TABLE public.ad_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_active INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ad_slots TO authenticated;
GRANT ALL ON public.ad_slots TO service_role;
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_slots_public_select" ON public.ad_slots FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ad_slots_admin_insert" ON public.ad_slots FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ad_slots_admin_update" ON public.ad_slots FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ad_slots_admin_delete" ON public.ad_slots FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ad_slots_updated_at BEFORE UPDATE ON public.ad_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BUSINESSES: add plan cache
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS current_plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;

-- BUSINESS SUBSCRIPTIONS
CREATE TABLE public.business_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  amount_paid NUMERIC(10,2),
  payment_ref TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_biz_sub_business ON public.business_subscriptions(business_id);
CREATE INDEX idx_biz_sub_status ON public.business_subscriptions(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_subscriptions TO authenticated;
GRANT ALL ON public.business_subscriptions TO service_role;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz_sub_owner_or_admin_select" ON public.business_subscriptions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
);
CREATE POLICY "biz_sub_admin_insert" ON public.business_subscriptions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "biz_sub_admin_update" ON public.business_subscriptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "biz_sub_admin_delete" ON public.business_subscriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER biz_sub_updated_at BEFORE UPDATE ON public.business_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED PLANS
INSERT INTO public.plans (name, slug, tier_order, price_monthly, price_yearly, description, features, color, icon, is_popular, max_photos, max_products, max_services, max_events, featured_listing, verified_badge, top_ranking, unlimited_leads, priority_support, analytics_access, banner_ad_slots) VALUES
('Free','free',1,0,0,'Basic listing to get started','["Basic business listing","Up to 5 photos","Customer reviews","Contact info visible"]','#94a3b8','sparkles',false,5,3,3,1,false,false,false,false,false,false,0),
('Silver','silver',2,499,4999,'Verified presence with more visibility','["Everything in Free","Verified badge","Up to 15 photos","10 products & services","3 events per month","Basic analytics"]','#94a3b8','shield-check',false,15,10,10,3,false,true,false,false,false,true,0),
('Gold','gold',3,1499,14999,'Top ranking + priority support','["Everything in Silver","Featured listing","Up to 40 photos","Unlimited products & services","Top ranking in category","Unlimited leads","Priority support","1 banner ad slot"]','#f59e0b','award',true,40,999,999,10,true,true,true,true,true,true,1),
('Platinum','platinum',4,4999,49999,'#1 spot with maximum reach','["Everything in Gold","#1 spot in category","Unlimited photos","Unlimited events","Homepage feature","3 banner ad slots","Dedicated account manager","Custom promotions"]','#a855f7','crown',false,999,999,999,999,true,true,true,true,true,true,3);

-- SEED AD SLOTS
INSERT INTO public.ad_slots (slot_key, name, description, price_monthly, price_yearly, max_active, display_order) VALUES
('homepage_top','Homepage Top Banner','Prime banner shown at the top of the homepage',4999,49999,3,1),
('category_banner','Category Page Banner','Banner shown on category listing pages',1999,19999,5,2),
('event_sponsor','Event Sponsorship','Sponsor an event and get logo placement',2999,29999,10,3),
('popular_search_featured','Popular Searches Featured','Featured card in the Popular Searches strip',1499,14999,10,4);
