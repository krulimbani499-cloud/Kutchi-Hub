ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS catalog_url TEXT,
  ADD COLUMN IF NOT EXISTS catalog_name TEXT;