-- ============================================================================
-- READ-ONLY checks for review-reports. Safe to run any time (nothing is written).
-- After 01_migration.sql every "ok" below must be true.
-- ============================================================================
SELECT c.relname AS "table", c.relrowsecurity AS rls_on
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('review_reports', 'review_hidden', 'review_user_blocks');

SELECT polrelid::regclass AS "table", polname AS policy, polcmd AS command
  FROM pg_policy
 WHERE polrelid IN ('public.review_reports'::regclass, 'public.review_hidden'::regclass,
                    'public.review_user_blocks'::regclass, 'public.business_reviews'::regclass)
 ORDER BY 1, 2;

SELECT 'all three tables have RLS on' AS "check",
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('review_reports', 'review_hidden', 'review_user_blocks') AND c.relrowsecurity) = 3 AS ok
UNION ALL
SELECT 'anon has no access to the new tables',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE grantee = 'anon' AND table_schema = 'public'
                      AND table_name IN ('review_reports', 'review_hidden', 'review_user_blocks'))
UNION ALL
SELECT 'report insert policy checks reporter_id = auth.uid()',
       EXISTS (SELECT 1 FROM pg_policy
                WHERE polrelid = 'public.review_reports'::regclass AND polcmd = 'a'
                  AND pg_get_expr(polwithcheck, polrelid) ILIKE '%reporter_id%auth.uid()%')
UNION ALL
SELECT 'business_reviews SELECT policy uses review_visible_to_caller',
       EXISTS (SELECT 1 FROM pg_policy
                WHERE polrelid = 'public.business_reviews'::regclass AND polcmd = 'r'
                  AND pg_get_expr(polqual, polrelid) ILIKE '%review_visible_to_caller%')
UNION ALL
SELECT 'only admins can write review_hidden (policy mentions has_role)',
       EXISTS (SELECT 1 FROM pg_policy
                WHERE polrelid = 'public.review_hidden'::regclass AND pg_get_expr(polqual, polrelid) ILIKE '%has_role%');
