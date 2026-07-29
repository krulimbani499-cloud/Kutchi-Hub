ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS app_discount_percent smallint,
  ADD COLUMN IF NOT EXISTS app_discount_label text,
  ADD COLUMN IF NOT EXISTS app_discount_valid_until date;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_app_discount_percent_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_app_discount_percent_check
  CHECK (app_discount_percent IS NULL OR (app_discount_percent BETWEEN 0 AND 100));