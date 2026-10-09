-- ============================================================================
-- VERIFY (run in the Supabase SQL editor). Everything here is read-only.
-- Run PART A BEFORE 01_migration.sql (planning), PART B+C AFTER it.
-- ============================================================================

-- ---- PART A: who would disappear? (authoritative; uses the real subscriptions)
SELECT b.name, b.city, c.name AS category, b.created_at::date AS created,
       b.owner_id IS NOT NULL AS has_owner
FROM public.businesses b
LEFT JOIN public.categories c ON c.id = b.category_id
WHERE b.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_subscriptions s
    WHERE s.business_id = b.id AND s.status = 'active'
      AND s.started_at <= now() AND (s.expires_at IS NULL OR s.expires_at > now()))
ORDER BY b.city, b.name;
-- Expect 11 rows or fewer (the public-key proxy found 11; the cached plan can be stale).

-- Sanity: a zero-price or missing-price plan would count as a "plan" under the rule.
-- You said there is no Free plan; this should return no row you did not expect.
SELECT slug, name, price_monthly, is_active FROM public.plans
WHERE COALESCE(price_monthly, 0) = 0 ORDER BY tier_order;

-- Subscriptions that are 'active' but already past expires_at (stale cache candidates)
SELECT b.name, s.expires_at FROM public.business_subscriptions s
JOIN public.businesses b ON b.id = s.business_id
WHERE s.status = 'active' AND s.expires_at <= now();

-- ---- PART B: role simulation, AFTER the migration -------------------------
-- Visible-business counts per role. Expect: anon = authenticated (non-owner) =
-- published businesses with an active plan; admin = all businesses.
BEGIN;
  SET LOCAL ROLE anon;
  SELECT 'anon' AS role, count(*) AS visible_businesses FROM public.businesses;
ROLLBACK;

BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
  SELECT 'authenticated (no owner, no admin)' AS role, count(*) AS visible_businesses FROM public.businesses;
ROLLBACK;

-- Replace <ADMIN_USER_ID> with a real admin user id from user_roles.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<ADMIN_USER_ID>","role":"authenticated"}', true);
--   SELECT 'admin' AS role, count(*) AS visible_businesses FROM public.businesses;  -- must equal total
-- ROLLBACK;

-- Replace <OWNER_USER_ID> with the owner of a published business that has no plan.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<OWNER_USER_ID>","role":"authenticated"}', true);
--   SELECT name, status FROM public.businesses WHERE owner_id = '<OWNER_USER_ID>'; -- owner still sees own rows
-- ROLLBACK;

-- ---- PART C: ground truth (as postgres) ----------------------------------
SELECT
  count(*) FILTER (WHERE status = 'published')                                  AS published,
  count(*) FILTER (WHERE status = 'published' AND public.business_has_active_plan(id)) AS live,
  count(*) FILTER (WHERE status = 'published' AND NOT public.business_has_active_plan(id)) AS hidden,
  count(*) AS total
FROM public.businesses;
-- anon count in PART B must equal "live" here.
