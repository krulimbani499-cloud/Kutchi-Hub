-- ============================================================================
-- PERFORMANCE INDEXES for the queries the site actually runs. Nothing here changes data or behaviour; it only lets
-- Postgres find rows without reading whole tables. Every statement is IF NOT EXISTS, so it is safe to run twice and
-- it skips an index that already exists under the same name.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- Already in the schema (not repeated): businesses(category_id), (city), (status), (slug, city) [unique],
-- (current_plan_id), (plan_tier_order); business_reviews(business_id); business_products(business_id);
-- business_services(business_id, display_order); business_subscriptions(business_id), (status); notifications(user_id, ...).
--
-- Why each one:
--   businesses(owner_id)              Dashboard "My Listings", every owner policy (owner_id = auth.uid()), delete-account.
--                                     Had NO index: every owner lookup read the whole table.
--   business_photos(business_id, ..)  The photos of one business, in order (business page, edit page, photo counts).
--   business_reviews(user_id)         "Has this person reviewed it", account deletion cascade, reward points.
--   business_claims(user_id)          Dashboard claims list.
--   businesses published ordering     Home, search, city and category pages all sort published businesses by
--                                     plan tier / featured / verified / name: one partial index serves that ORDER BY.
--   pg_trgm GIN on name / city        Search uses ILIKE '%text%' on business name, city, product and service names; a plain
--                                     index cannot help with a leading %, a trigram index can.
-- ============================================================================
BEGIN;

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON public.businesses (owner_id);

CREATE INDEX IF NOT EXISTS idx_business_photos_business ON public.business_photos (business_id, display_order);

CREATE INDEX IF NOT EXISTS idx_business_reviews_user ON public.business_reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_business_claims_user ON public.business_claims (user_id);

CREATE INDEX IF NOT EXISTS idx_businesses_published_order
  ON public.businesses (plan_tier_order DESC, plan_featured DESC, verified DESC, name, id)
  WHERE status = 'published';

-- Trigram indexes for ILIKE '%...%' search (the extension ships with Supabase).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON public.businesses USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_city_trgm ON public.businesses USING gin (city extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_business_products_name_trgm ON public.business_products USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_business_services_name_trgm ON public.business_services USING gin (name extensions.gin_trgm_ops);

COMMIT;
