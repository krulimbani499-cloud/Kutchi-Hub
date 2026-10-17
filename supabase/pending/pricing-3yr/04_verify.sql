-- ============================================================================
-- READ-ONLY checks for pricing-3yr. Safe to run any time (nothing is written).
-- Run after 01_migration.sql: every row of query 1 must say ok = true.
-- Run after 02_extend_existing.sql: query 3 must return no rows.
-- ============================================================================

-- 1) The plan rows are exactly as intended -------------------------------------------------------------------
SELECT 'silver: 36 months, 500, photos 5, products 0, services 0, verified, analytics, banners 0, no catalog, texts' AS "check",
       (SELECT count(*) FROM public.plans WHERE id = '7f66fb32-db17-4cbc-bc2a-57f9e2f61754' AND slug = 'silver'
          AND billing_period_months = 36 AND price_yearly = 500 AND price_monthly = 14
          AND max_photos = 5 AND max_products = 0 AND max_services = 0
          AND featured_listing = false AND verified_badge = true AND top_ranking = false AND analytics_access = true
          AND banner_ad_slots = 0 AND allow_catalog = false
          AND features = '["Verified badge","Up to 5 photos","Basic analytics (views & calls)","Call, WhatsApp & Directions buttons"]'::jsonb) = 1 AS ok
UNION ALL
SELECT 'gold: 36 months, 1500, photos 20, products 10, services 10, featured + top ranking, banner 1, catalog, texts',
       (SELECT count(*) FROM public.plans WHERE id = 'c3e0b34e-a7ad-40b6-a887-9e9131033178' AND slug = 'gold'
          AND billing_period_months = 36 AND price_yearly = 1500 AND price_monthly = 42
          AND max_photos = 20 AND max_products = 10 AND max_services = 10
          AND featured_listing = true AND verified_badge = true AND top_ranking = true AND analytics_access = true
          AND banner_ad_slots = 1 AND allow_catalog = true
          AND features = '["Everything in Silver","Featured listing","Top ranking in category","Up to 20 photos","10 products & services","1 banner ad","Product catalog (PDF)"]'::jsonb) = 1
UNION ALL
SELECT 'platinum: 36 months, 5000, photos 40, products/services 999, featured + top ranking, banner 3, catalog, texts',
       (SELECT count(*) FROM public.plans WHERE id = '2eaf997d-2f9f-40e9-8491-721be0aa4eef' AND slug = 'platinum'
          AND billing_period_months = 36 AND price_yearly = 5000 AND price_monthly = 139
          AND max_photos = 40 AND max_products = 999 AND max_services = 999
          AND featured_listing = true AND verified_badge = true AND top_ranking = true AND analytics_access = true
          AND banner_ad_slots = 3 AND allow_catalog = true
          AND features = '["Everything in Gold","Homepage Spotlight in your city","Up to 40 photos","Unlimited products & services","3 homepage banner ads","3 event/offer promotions","Custom promotions","Product catalog (PDF)"]'::jsonb) = 1
UNION ALL
SELECT 'enterprise unchanged: 12 months, 25000',
       (SELECT count(*) FROM public.plans WHERE id = '57e87ca2-9419-416b-822f-9a3aa0e8ba44' AND slug = 'enterprise'
          AND billing_period_months = 12 AND price_yearly = 25000 AND price_monthly = 25000) = 1
UNION ALL
SELECT 'the column has its 1..120 check constraint',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plans'::regclass AND conname = 'plans_billing_period_months_check')
UNION ALL
SELECT 'features is still a jsonb array on every plan',
       (SELECT bool_and(jsonb_typeof(features) = 'array') FROM public.plans);

-- 2) Side by side: what each plan now offers ------------------------------------------------------------------------
SELECT slug, tier_order, billing_period_months, price_yearly AS price_for_period, price_monthly AS per_month,
       max_photos, max_products, max_services, banner_ad_slots, featured_listing, top_ranking, allow_catalog, is_active
  FROM public.plans
 ORDER BY tier_order;

-- 3) After 02_extend_existing.sql: active Silver / Gold / Platinum subscriptions still shorter than 36 months (expect 0 rows)
SELECT b.name AS business, p.slug AS plan, s.started_at, s.expires_at
  FROM public.business_subscriptions s
  JOIN public.plans      p ON p.id = s.plan_id
  JOIN public.businesses b ON b.id = s.business_id
 WHERE p.slug IN ('silver', 'gold', 'platinum')
   AND s.status = 'active' AND s.started_at <= now()
   AND s.expires_at IS NOT NULL AND s.expires_at > now()
   AND s.started_at + interval '36 months' > s.expires_at;

-- 4) Existing items on a plan that now allows none (informational: they are kept, only new ones are blocked)
SELECT b.name AS business, p.slug AS plan,
       (SELECT count(*) FROM public.business_products x WHERE x.business_id = b.id) AS products_saved,
       (SELECT count(*) FROM public.business_services x WHERE x.business_id = b.id) AS services_saved
  FROM public.businesses b
  JOIN public.plans p ON p.id = b.current_plan_id
 WHERE p.max_products = 0 OR p.max_services = 0
 ORDER BY b.name;
