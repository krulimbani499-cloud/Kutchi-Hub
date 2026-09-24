ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
