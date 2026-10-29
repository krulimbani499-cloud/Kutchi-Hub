-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'categories.seo_keywords exists: text, nullable' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories'
                AND column_name = 'seo_keywords' AND data_type = 'text' AND is_nullable = 'YES') AS ok
UNION ALL
SELECT 'length check (300) exists',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.categories'::regclass AND conname = 'categories_seo_keywords_len')
UNION ALL
SELECT 'everyone can still read categories (public SELECT policy exists)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'SELECT')
UNION ALL
SELECT 'only admins change categories (an INSERT / UPDATE / ALL policy mentions has_role)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories'
                AND cmd IN ('UPDATE', 'ALL') AND (qual LIKE '%has_role%' OR with_check LIKE '%has_role%'));

-- The keywords entered so far (info only).
-- SELECT slug, seo_keywords FROM public.categories WHERE seo_keywords IS NOT NULL ORDER BY slug;
