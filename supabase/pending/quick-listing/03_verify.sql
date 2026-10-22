-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'contact_name: text, nullable' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'contact_name' AND data_type = 'text' AND is_nullable = 'YES') AS ok
UNION ALL
SELECT 'quick_lead: boolean, NOT NULL, default false',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'quick_lead' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'false')
UNION ALL
SELECT 'category_id is nullable now',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'category_id' AND is_nullable = 'YES')
UNION ALL
SELECT '(only right after 01 runs) no existing business was marked as a quick lead', NOT EXISTS (SELECT 1 FROM public.businesses WHERE quick_lead)
UNION ALL
SELECT 'business_owner_can_edit mentions quick_lead',
       (SELECT pg_get_functiondef(p.oid) LIKE '%quick_lead%' FROM pg_proc p WHERE p.oid = to_regprocedure('public.business_owner_can_edit(uuid)'));

-- Every other column that is NOT NULL and has no default: the quick form must be able to fill all of them.
-- Expected: only name, slug (the app always sets both).
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'businesses' AND is_nullable = 'NO' AND column_default IS NULL
 ORDER BY ordinal_position;
