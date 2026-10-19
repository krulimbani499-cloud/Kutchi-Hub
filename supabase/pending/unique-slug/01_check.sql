-- ============================================================================
-- READ-ONLY. Run this first, in the Supabase SQL editor. Nothing here changes data.
-- STATUS: NOT RUN.
-- ============================================================================

-- 1) Every slug used by more than one business (this is what 02_migration.sql refuses to start with).
--    Zero rows = safe to run 02_migration.sql.
SELECT b.slug,
       count(*) OVER (PARTITION BY b.slug)  AS businesses_with_this_slug,
       b.id,
       b.name,
       b.city,
       b.status,
       b.owner_id,
       b.created_at
  FROM public.businesses b
 WHERE b.slug IN (SELECT slug FROM public.businesses GROUP BY slug HAVING count(*) > 1)
 ORDER BY b.slug, b.created_at;

-- 2) Same question, one line per slug.
SELECT slug, count(*) AS businesses, string_agg(name || ' (' || coalesce(city, '-') || ', ' || status || ')', ' | ' ORDER BY created_at) AS which
  FROM public.businesses
 GROUP BY slug
HAVING count(*) > 1
 ORDER BY count(*) DESC, slug;

-- 3) Businesses with MORE THAN ONE active subscription right now (the "plan assigned twice" case).
SELECT s.business_id,
       b.name,
       count(*)                                   AS active_subscriptions,
       string_agg(p.name || ' until ' || coalesce(to_char(s.expires_at, 'YYYY-MM-DD'), 'no end date')
                  || ' (id ' || s.id || ')', ' | ' ORDER BY s.started_at) AS subscriptions
  FROM public.business_subscriptions s
  JOIN public.businesses b ON b.id = s.business_id
  JOIN public.plans p      ON p.id = s.plan_id
 WHERE s.status = 'active'
   AND (s.expires_at IS NULL OR s.expires_at > now())
 GROUP BY s.business_id, b.name
HAVING count(*) > 1
 ORDER BY count(*) DESC, b.name;
