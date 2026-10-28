-- READ-ONLY. Run after 01_migration.sql. Every row of the first query should say ok = true.
SELECT 'show_services: boolean, NOT NULL, default false' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'show_services' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'false') AS ok
UNION ALL
SELECT 'show_products: boolean, NOT NULL, default false',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'show_products' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'false')
UNION ALL
-- Backfill (only meaningful right after 01 ran, before owners start switching things off): nothing that had items was left OFF.
SELECT '(right after 01) every business with an active service has show_services = true',
       NOT EXISTS (SELECT 1 FROM public.businesses b
                    WHERE NOT b.show_services AND EXISTS (SELECT 1 FROM public.business_services s WHERE s.business_id = b.id AND s.active))
UNION ALL
SELECT '(right after 01) every business with an active product has show_products = true',
       NOT EXISTS (SELECT 1 FROM public.businesses b
                    WHERE NOT b.show_products AND EXISTS (SELECT 1 FROM public.business_products p WHERE p.business_id = b.id AND p.active))
UNION ALL
SELECT '(right after 01) a business with no active service / product is OFF',
       NOT EXISTS (SELECT 1 FROM public.businesses b
                    WHERE (b.show_services AND NOT EXISTS (SELECT 1 FROM public.business_services s WHERE s.business_id = b.id AND s.active))
                       OR (b.show_products AND NOT EXISTS (SELECT 1 FROM public.business_products p WHERE p.business_id = b.id AND p.active)))
UNION ALL
-- Owners may edit the two columns: the guard trigger must not mention them, and the owner UPDATE policy must have no column limit.
SELECT 'guard_business_admin_columns does not lock show_services / show_products',
       (SELECT pg_get_functiondef(p.oid) NOT LIKE '%show\_services%' AND pg_get_functiondef(p.oid) NOT LIKE '%show\_products%'
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.guard_business_admin_columns()'))
UNION ALL
SELECT 'owner UPDATE policy exists on businesses (no column list: covers the new columns)',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'businesses' AND cmd = 'UPDATE')
UNION ALL
SELECT 'no column-level UPDATE grant restricts authenticated on businesses (expected: true)',
       NOT EXISTS (SELECT 1 FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'businesses' AND grantee = 'authenticated' AND privilege_type = 'UPDATE')
       OR has_table_privilege('authenticated', 'public.businesses', 'UPDATE')
UNION ALL
SELECT 'update_businesses_updated_at trigger is enabled again',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.businesses'::regclass AND tgname = 'update_businesses_updated_at' AND tgenabled = 'O');

-- How many businesses show each section now (info only).
SELECT count(*) FILTER (WHERE show_services) AS services_on, count(*) FILTER (WHERE show_products) AS products_on, count(*) AS businesses
  FROM public.businesses;
