-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'categories.created_by exists (uuid, nullable)' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories'
                AND column_name = 'created_by' AND data_type = 'uuid' AND is_nullable = 'YES') AS ok
UNION ALL
SELECT 'categories.created_at exists',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'created_at')
UNION ALL
SELECT 'index for the daily count exists',
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'categories' AND indexname = 'idx_categories_created_by_at')
UNION ALL
SELECT 'category INSERT is still admin-only (run category-admin-insert too if this is false)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'INSERT' AND with_check LIKE '%has_role%')
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'INSERT' AND (with_check = 'true' OR with_check LIKE '(auth.uid() IS NOT NULL)%'));

-- Categories made through the site so far (info only):
-- SELECT c.name, c.slug, c.created_at, u.email FROM public.categories c LEFT JOIN auth.users u ON u.id = c.created_by WHERE c.created_by IS NOT NULL ORDER BY c.created_at DESC;
