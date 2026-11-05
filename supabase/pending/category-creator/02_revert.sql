BEGIN;
DROP INDEX IF EXISTS public.idx_categories_created_by_at;
ALTER TABLE public.categories DROP COLUMN IF EXISTS created_by;
COMMIT;
