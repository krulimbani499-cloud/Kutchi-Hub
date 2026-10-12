-- ============================================================================
-- VERIFY (Supabase SQL editor). Everything uncommented here is READ-ONLY.
-- ============================================================================

-- (a) BEFORE applying: published businesses that would be LOCKED for their owner
--     (published, no active subscription). Uses the same "active" rule as the migration.
SELECT b.name, b.city, u.email AS owner_email, b.created_at::date AS created
FROM public.businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE b.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_subscriptions s
    WHERE s.business_id = b.id
      AND s.status = 'active'
      AND s.started_at <= now()
      AND (s.expires_at IS NULL OR s.expires_at > now())
  )
ORDER BY b.city, b.name;

-- (b) The policies on the affected tables and the storage policies. Run it BEFORE applying
--     (save the output: it is the exact state to restore) and AFTER applying (owner policies must
--     now mention business_owner_can_edit; admin and SELECT/DELETE/INSERT policies must be unchanged).
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('businesses', 'business_photos', 'business_products', 'business_services'))
   OR (schemaname = 'storage' AND tablename = 'objects'
       AND (qual ILIKE '%business-photos%' OR with_check ILIKE '%business-photos%'))
ORDER BY schemaname, tablename, cmd, policyname;

-- (c) AFTER applying: triggers and functions exist.
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.businesses'::regclass AND NOT tgisinternal ORDER BY tgname;
-- expect businesses_guard_admin_columns among them

SELECT proname, prosecdef AS security_definer, proconfig AS config
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('business_owner_can_edit', 'business_has_active_plan', 'guard_business_admin_columns');
-- expect 3 rows, security_definer = true, config containing search_path=public

-- (d) AFTER applying: what the owner can do right now, per business (should match list (a) for published ones).
SELECT b.name, b.city, b.status,
       public.business_has_active_plan(b.id) AS has_active_plan,
       public.business_owner_can_edit(b.id)  AS owner_can_edit
FROM public.businesses b
ORDER BY owner_can_edit, b.city, b.name;
-- published + has_active_plan = false  ->  owner_can_edit = false (locked)
-- pending / rejected                   ->  owner_can_edit = true

-- (e) OPTIONAL behaviour test. Not read-only in spirit: it runs inside a transaction that is rolled
--     back, so nothing is saved. Replace the two ids, uncomment, run as one block.
--
-- BEGIN;
--   -- a locked owner (owner of a published business with NO active plan)
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<LOCKED_OWNER_USER_ID>","role":"authenticated"}', true);
--   UPDATE public.businesses SET description = description WHERE id = '<LOCKED_BUSINESS_ID>';   -- expect: UPDATE 0
--   UPDATE public.businesses SET status = 'pending'       WHERE id = '<LOCKED_BUSINESS_ID>';   -- expect: UPDATE 0 (and the guard trigger blocks it anyway)
--   INSERT INTO public.business_services (business_id, name) VALUES ('<LOCKED_BUSINESS_ID>', 'test'); -- expect: row-level security error
--   DELETE FROM public.businesses WHERE id = '<LOCKED_BUSINESS_ID>' AND false;                  -- delete policy unchanged
-- ROLLBACK;
