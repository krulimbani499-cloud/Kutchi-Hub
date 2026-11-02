-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'businesses.notify_city exists, default true, not null' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'notify_city'
                  AND is_nullable = 'NO' AND column_default = 'true') AS ok
UNION ALL
SELECT 'RLS is ON for push_subscriptions, city_notify_queue and city_notify_log',
       (SELECT count(*) FROM pg_class
         WHERE oid IN (to_regclass('public.push_subscriptions'), to_regclass('public.city_notify_queue'), to_regclass('public.city_notify_log'))
           AND relrowsecurity) = 3
UNION ALL
SELECT 'anon has NO access to any of the three tables',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND grantee = 'anon'
                      AND table_name IN ('push_subscriptions', 'city_notify_queue', 'city_notify_log'))
UNION ALL
SELECT 'signed-in users can only SELECT / DELETE push_subscriptions (no INSERT / UPDATE)',
       (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND grantee = 'authenticated') = 'DELETE,SELECT'
UNION ALL
SELECT 'queue and log: signed-in users can only SELECT (the policy lets admins only)',
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('city_notify_queue', 'city_notify_log') AND cmd = 'SELECT') = 2
       AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                        WHERE table_schema = 'public' AND table_name IN ('city_notify_queue', 'city_notify_log')
                          AND grantee = 'authenticated' AND privilege_type <> 'SELECT')
UNION ALL
SELECT 'push_subscriptions: token unique, platform limited to web / android / ios',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.push_subscriptions') AND conname = 'push_subscriptions_token_key')
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.push_subscriptions') AND contype = 'c'
                    AND pg_get_constraintdef(oid) LIKE '%web%' AND pg_get_constraintdef(oid) LIKE '%android%')
UNION ALL
SELECT 'one queue row per business, one single notification per business, one summary per city and day',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.city_notify_queue') AND conname = 'city_notify_queue_business_key')
       AND to_regclass('public.city_notify_log_single_once') IS NOT NULL
       AND to_regclass('public.city_notify_log_summary_once') IS NOT NULL
UNION ALL
SELECT 'both triggers exist on businesses',
       (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.businesses'::regclass AND NOT tgisinternal
          AND tgname IN ('businesses_enqueue_city_notification', 'businesses_guard_notify_city')) = 2
UNION ALL
SELECT 'claim_city_notify_rows is callable by the service role only',
       has_function_privilege('service_role', 'public.claim_city_notify_rows(integer)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.claim_city_notify_rows(integer)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.claim_city_notify_rows(integer)', 'EXECUTE');

-- After you have tried it: what is in the queue and what was sent
-- SELECT status, count(*) FROM public.city_notify_queue GROUP BY 1 ORDER BY 1;
-- SELECT day, city_key, kind, item_count, sent, failed FROM public.city_notify_log ORDER BY created_at DESC LIMIT 20;
