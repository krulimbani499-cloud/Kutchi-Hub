-- ============================================================================
-- VERIFY (Supabase SQL editor). Everything here is READ-ONLY.
-- ============================================================================

-- (a) BEFORE applying: businesses that have a catalog today but would NOT be allowed to keep showing it
--     (no active subscription on a plan other than Silver). Their files and values are never deleted;
--     the app simply stops showing the catalog publicly and hides the upload card for the owner.
SELECT b.name, b.city, b.status, b.catalog_name,
       COALESCE((
         SELECT string_agg(p.name, ', ')
         FROM public.business_subscriptions s JOIN public.plans p ON p.id = s.plan_id
         WHERE s.business_id = b.id AND s.status = 'active'
           AND s.started_at <= now() AND (s.expires_at IS NULL OR s.expires_at > now())
       ), '(no active plan)') AS active_plan
FROM public.businesses b
WHERE b.catalog_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_subscriptions s JOIN public.plans p ON p.id = s.plan_id
    WHERE s.business_id = b.id AND s.status = 'active'
      AND s.started_at <= now() AND (s.expires_at IS NULL OR s.expires_at > now())
      AND p.slug <> 'silver'
  )
ORDER BY b.city, b.name;

-- (b) AFTER applying: the same question using the real function.
SELECT b.name, b.city, b.status, b.catalog_name
FROM public.businesses b
WHERE b.catalog_url IS NOT NULL
  AND NOT public.business_can_use_catalog(b.id)
ORDER BY b.city, b.name;

-- (c) AFTER applying: the flag per plan (expect Silver = false, everything else true).
SELECT name, slug, tier_order, allow_catalog FROM public.plans ORDER BY tier_order;

-- (d) AFTER applying: what exists.
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.businesses'::regclass AND NOT tgisinternal ORDER BY tgname;
-- expect businesses_guard_catalog (and, from edit-requires-plan, businesses_guard_admin_columns)

SELECT policyname, cmd, permissive, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE 'Catalog PDFs%'
ORDER BY policyname;
-- expect 2 rows, permissive = RESTRICTIVE
