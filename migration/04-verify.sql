-- Run against BOTH the old and the new database, then diff the output.
-- psql "$OLD_DB_URL" -f 04-verify.sql > /tmp/old.txt
-- psql "$NEW_DB_URL" -f 04-verify.sql > /tmp/new.txt
-- diff /tmp/old.txt /tmp/new.txt      <-- must be empty

\pset format aligned
\echo === ROW COUNTS ===
SELECT 'ad_slots' t, count(*) FROM public.ad_slots
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs
UNION ALL SELECT 'banner_ads', count(*) FROM public.banner_ads
UNION ALL SELECT 'business_claims', count(*) FROM public.business_claims
UNION ALL SELECT 'business_enquiries', count(*) FROM public.business_enquiries
UNION ALL SELECT 'business_events', count(*) FROM public.business_events
UNION ALL SELECT 'business_favorites', count(*) FROM public.business_favorites
UNION ALL SELECT 'business_photos', count(*) FROM public.business_photos
UNION ALL SELECT 'business_products', count(*) FROM public.business_products
UNION ALL SELECT 'business_reviews', count(*) FROM public.business_reviews
UNION ALL SELECT 'business_services', count(*) FROM public.business_services
UNION ALL SELECT 'business_subscriptions', count(*) FROM public.business_subscriptions
UNION ALL SELECT 'businesses', count(*) FROM public.businesses
UNION ALL SELECT 'categories', count(*) FROM public.categories
UNION ALL SELECT 'discount_claims', count(*) FROM public.discount_claims
UNION ALL SELECT 'events', count(*) FROM public.events
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'plans', count(*) FROM public.plans
UNION ALL SELECT 'point_events', count(*) FROM public.point_events
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'referrals', count(*) FROM public.referrals
UNION ALL SELECT 'reports', count(*) FROM public.reports
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users
ORDER BY 1;

\echo === CHECKSUMS (catches silently-changed values, not just counts) ===
SELECT 'businesses' t, md5(string_agg(id::text, ',' ORDER BY id)) FROM public.businesses
UNION ALL SELECT 'categories', md5(string_agg(id::text, ',' ORDER BY id)) FROM public.categories
UNION ALL SELECT 'profiles', md5(string_agg(user_id::text, ',' ORDER BY user_id)) FROM public.profiles
UNION ALL SELECT 'user_roles', md5(string_agg(user_id::text || role::text, ',' ORDER BY user_id, role)) FROM public.user_roles
UNION ALL SELECT 'business_photos', md5(string_agg(id::text, ',' ORDER BY id)) FROM public.business_photos
UNION ALL SELECT 'business_products', md5(string_agg(id::text, ',' ORDER BY id)) FROM public.business_products
UNION ALL SELECT 'auth.users', md5(string_agg(id::text, ',' ORDER BY id)) FROM auth.users
ORDER BY 1;

\echo === ORPHAN CHECK (all must be 0) ===
SELECT 'businesses.category_id' k, count(*) FROM public.businesses b
  LEFT JOIN public.categories c ON c.id = b.category_id WHERE c.id IS NULL
UNION ALL SELECT 'businesses.owner_id', count(*) FROM public.businesses b
  LEFT JOIN auth.users u ON u.id = b.owner_id WHERE b.owner_id IS NOT NULL AND u.id IS NULL
UNION ALL SELECT 'businesses.current_plan_id', count(*) FROM public.businesses b
  LEFT JOIN public.plans p ON p.id = b.current_plan_id WHERE b.current_plan_id IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'profiles.user_id', count(*) FROM public.profiles pr
  LEFT JOIN auth.users u ON u.id = pr.user_id WHERE u.id IS NULL
UNION ALL SELECT 'user_roles.user_id', count(*) FROM public.user_roles r
  LEFT JOIN auth.users u ON u.id = r.user_id WHERE u.id IS NULL
UNION ALL SELECT 'business_photos.business_id', count(*) FROM public.business_photos x
  LEFT JOIN public.businesses b ON b.id = x.business_id WHERE b.id IS NULL
UNION ALL SELECT 'business_products.business_id', count(*) FROM public.business_products x
  LEFT JOIN public.businesses b ON b.id = x.business_id WHERE b.id IS NULL
UNION ALL SELECT 'business_services.business_id', count(*) FROM public.business_services x
  LEFT JOIN public.businesses b ON b.id = x.business_id WHERE b.id IS NULL
UNION ALL SELECT 'business_reviews.user_id', count(*) FROM public.business_reviews x
  LEFT JOIN auth.users u ON u.id = x.user_id WHERE u.id IS NULL
UNION ALL SELECT 'point_events.user_id', count(*) FROM public.point_events x
  LEFT JOIN auth.users u ON u.id = x.user_id WHERE u.id IS NULL
UNION ALL SELECT 'notifications.user_id', count(*) FROM public.notifications x
  LEFT JOIN auth.users u ON u.id = x.user_id WHERE u.id IS NULL
ORDER BY 1;

\echo === ADMIN SANITY (must list your admin account) ===
SELECT u.email, r.role FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id WHERE r.role = 'admin';
