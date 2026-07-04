CREATE TABLE public.banner_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  cta_label text,
  cta_url text,
  city text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX banner_ads_city_active_idx ON public.banner_ads (lower(city), active, priority DESC);

GRANT SELECT ON public.banner_ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banner_ads TO authenticated;
GRANT ALL ON public.banner_ads TO service_role;

ALTER TABLE public.banner_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view live banners"
  ON public.banner_ads FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND start_at <= now()
    AND (end_at IS NULL OR end_at > now())
  );

CREATE POLICY "Owners can view their banners"
  ON public.banner_ads FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all banners"
  ON public.banner_ads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can create their banners"
  ON public.banner_ads FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can create any banner"
  ON public.banner_ads FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can update their banners"
  ON public.banner_ads FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update any banner"
  ON public.banner_ads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can delete their banners"
  ON public.banner_ads FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can delete any banner"
  ON public.banner_ads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_banner_ads_updated_at
  BEFORE UPDATE ON public.banner_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();