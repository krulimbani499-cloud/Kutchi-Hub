-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'device_tokens exists with RLS on' AS check,
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.device_tokens')), false) AS ok
UNION ALL
SELECT 'token is unique',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.device_tokens') AND conname = 'device_tokens_token_key')
UNION ALL
SELECT 'platform is limited to ios / android',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.device_tokens') AND contype = 'c'
                AND pg_get_constraintdef(oid) LIKE '%ios%' AND pg_get_constraintdef(oid) LIKE '%android%')
UNION ALL
SELECT 'signed-in users can only SELECT / DELETE (no INSERT / UPDATE grant)',
       (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'device_tokens' AND grantee = 'authenticated') = 'DELETE,SELECT'
UNION ALL
SELECT 'anon has no access',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'device_tokens' AND grantee = 'anon')
UNION ALL
SELECT 'two own-row policies (select, delete)',
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'device_tokens') = 2;
