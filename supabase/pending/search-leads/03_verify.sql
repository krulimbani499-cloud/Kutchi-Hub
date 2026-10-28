-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'table search_leads exists' AS check,
       to_regclass('public.search_leads') IS NOT NULL AS ok
UNION ALL
SELECT 'row level security is ON',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.search_leads')), false)
UNION ALL
SELECT 'exactly one INSERT policy (anon + authenticated) and one SELECT policy (authenticated, admin only)',
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'search_leads' AND cmd = 'INSERT') = 1
       AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'search_leads' AND cmd = 'SELECT') = 1
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'search_leads' AND cmd IN ('UPDATE', 'DELETE', 'ALL'))
UNION ALL
SELECT 'the SELECT policy checks has_role(..., admin)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'search_leads' AND cmd = 'SELECT'
                AND qual LIKE '%has_role%' AND qual LIKE '%admin%')
UNION ALL
SELECT 'anon can INSERT but cannot SELECT / UPDATE / DELETE',
       has_table_privilege('anon', 'public.search_leads', 'INSERT')
       AND NOT has_table_privilege('anon', 'public.search_leads', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.search_leads', 'UPDATE')
       AND NOT has_table_privilege('anon', 'public.search_leads', 'DELETE')
UNION ALL
SELECT 'authenticated can INSERT and SELECT (rows limited to admins by the policy) but not UPDATE / DELETE',
       has_table_privilege('authenticated', 'public.search_leads', 'INSERT')
       AND has_table_privilege('authenticated', 'public.search_leads', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.search_leads', 'UPDATE')
       AND NOT has_table_privilege('authenticated', 'public.search_leads', 'DELETE')
UNION ALL
SELECT 'the BEFORE INSERT trigger (rate limit + duplicate guard) is enabled',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.search_leads'::regclass
                AND tgname = 'search_leads_before_insert' AND tgenabled = 'O')
UNION ALL
SELECT 'the trigger function is not callable by anon / authenticated',
       NOT has_function_privilege('anon', 'public.search_leads_before_insert()', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.search_leads_before_insert()', 'EXECUTE')
UNION ALL
SELECT 'check constraints present (name, phone, consent, lengths)',
       (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.search_leads'::regclass AND contype = 'c') >= 6;

-- How many leads there are (info only; as the admin).
-- SELECT count(*) AS leads, min(created_at) AS first, max(created_at) AS last FROM public.search_leads;

-- Manual check of the rate limit (run as a test, then delete the rows; NOT part of the automatic checks above):
--   six INSERTs with the same ip_hash and six different valid phone numbers inside an hour: the sixth must fail
--   with 'search_leads_rate_limited'. The same phone + category twice inside 10 minutes: the second INSERT does nothing.
