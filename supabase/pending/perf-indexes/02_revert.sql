-- Revert of 01_migration.sql: drops only the indexes it created (the pg_trgm extension is left installed; it is harmless).
BEGIN;
DROP INDEX IF EXISTS public.idx_businesses_owner;
DROP INDEX IF EXISTS public.idx_business_photos_business;
DROP INDEX IF EXISTS public.idx_business_reviews_user;
DROP INDEX IF EXISTS public.idx_business_claims_user;
DROP INDEX IF EXISTS public.idx_businesses_published_order;
DROP INDEX IF EXISTS public.idx_businesses_name_trgm;
DROP INDEX IF EXISTS public.idx_businesses_city_trgm;
DROP INDEX IF EXISTS public.idx_business_products_name_trgm;
DROP INDEX IF EXISTS public.idx_business_services_name_trgm;
COMMIT;
