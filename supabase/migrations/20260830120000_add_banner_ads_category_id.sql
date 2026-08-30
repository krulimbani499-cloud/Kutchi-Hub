ALTER TABLE public.banner_ads
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX banner_ads_category_active_idx ON public.banner_ads (category_id, active, priority DESC);
