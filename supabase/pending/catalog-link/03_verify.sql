-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'businesses.catalog_link: text, nullable' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'catalog_link' AND data_type = 'text' AND is_nullable = 'YES') AS ok
UNION ALL
SELECT 'business_products.link_url: text, nullable',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_products'
                AND column_name = 'link_url' AND data_type = 'text' AND is_nullable = 'YES')
UNION ALL
SELECT 'https-only CHECK on businesses.catalog_link',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.businesses'::regclass AND conname = 'businesses_catalog_link_https' AND contype = 'c')
UNION ALL
SELECT 'https-only CHECK on business_products.link_url',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.business_products'::regclass AND conname = 'business_products_link_url_https' AND contype = 'c')
UNION ALL
SELECT 'guard_business_catalog covers catalog_link',
       (SELECT pg_get_functiondef(p.oid) LIKE '%catalog_link%' FROM pg_proc p WHERE p.oid = to_regprocedure('public.guard_business_catalog()'))
UNION ALL
SELECT 'guard_business_catalog is SECURITY DEFINER with a fixed search_path',
       (SELECT p.prosecdef AND p.proconfig::text LIKE '%search_path=public%' FROM pg_proc p WHERE p.oid = to_regprocedure('public.guard_business_catalog()'))
UNION ALL
SELECT 'businesses_guard_catalog trigger is enabled (INSERT and UPDATE)',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.businesses'::regclass AND tgname = 'businesses_guard_catalog' AND tgenabled = 'O'
                AND (tgtype & 4) <> 0 AND (tgtype & 16) <> 0)
UNION ALL
SELECT 'no existing row breaks the https rule (expected: true)',
       NOT EXISTS (SELECT 1 FROM public.businesses WHERE catalog_link IS NOT NULL AND catalog_link !~* '^https://')
       AND NOT EXISTS (SELECT 1 FROM public.business_products WHERE link_url IS NOT NULL AND link_url !~* '^https://');

-- Info: how many links are saved.
SELECT (SELECT count(*) FROM public.businesses WHERE catalog_link IS NOT NULL) AS business_catalog_links,
       (SELECT count(*) FROM public.business_products WHERE link_url IS NOT NULL) AS product_links;
