BEGIN;
DROP TRIGGER IF EXISTS businesses_track_archive ON public.businesses;
DROP FUNCTION IF EXISTS public.track_business_archive();
ALTER TABLE public.businesses DROP COLUMN IF EXISTS archived_by;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS archived_at;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS archived_from_status;
COMMIT;
