-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'exactly one INSERT policy on categories' AS check,
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'INSERT') = 1 AS ok
UNION ALL
SELECT 'that INSERT policy checks has_role (admin only)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'INSERT'
                AND with_check LIKE '%has_role%' AND with_check LIKE '%admin%')
UNION ALL
SELECT 'no INSERT policy is open to everybody (WITH CHECK true / auth.uid() IS NOT NULL)',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'INSERT'
                AND (with_check = 'true' OR with_check LIKE '(auth.uid() IS NOT NULL)%'))
UNION ALL
SELECT 'everyone can still read categories (a SELECT policy exists)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'SELECT');

-- The policies now (info only).
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' ORDER BY cmd, policyname;
