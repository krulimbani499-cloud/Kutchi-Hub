ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS popular_image_url TEXT,
  ADD COLUMN IF NOT EXISTS popular_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_categories_popular_featured
  ON public.categories(popular_featured) WHERE popular_featured = true;