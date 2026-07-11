
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
