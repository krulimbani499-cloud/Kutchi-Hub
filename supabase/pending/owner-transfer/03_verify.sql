-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'guard function mentions owner_id' AS check,
       COALESCE((SELECT pg_get_functiondef(p.oid) LIKE '%change the owner of a business%'
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.guard_business_admin_columns()')), false) AS ok
UNION ALL
SELECT 'guard trigger is attached to businesses (insert + update) and enabled',
       EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.businesses'::regclass AND t.tgname = 'businesses_guard_admin_columns'
                AND t.tgenabled = 'O' AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'guard function runs as its owner (SECURITY DEFINER) so has_role() works for any caller',
       COALESCE((SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.guard_business_admin_columns()')), false);

-- For information: who may update a business row (the owner policy must still end in "owner_id = auth.uid() ..." in WITH CHECK).
SELECT policyname, cmd, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'businesses' AND cmd IN ('UPDATE', 'ALL');
