-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'update trigger on business_services' AS check,
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_service_plan_update' AND tgrelid = 'public.business_services'::regclass AND NOT tgisinternal) AS ok
UNION ALL
SELECT 'update trigger on business_products',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_product_plan_update' AND tgrelid = 'public.business_products'::regclass AND NOT tgisinternal)
UNION ALL
SELECT 'the insert triggers are still there (enforce_business_plan_limit)',
       (SELECT count(*) FROM pg_trigger WHERE tgname IN ('enforce_service_plan_limit', 'enforce_product_plan_limit') AND NOT tgisinternal) = 2
UNION ALL
SELECT 'Silver has 0 products and 0 services (the rule this gate follows)',
       EXISTS (SELECT 1 FROM public.plans WHERE slug = 'silver' AND max_products = 0 AND max_services = 0);

-- Which businesses on a plan with 0 services / products still have rows (info only; nothing is deleted by this migration).
-- SELECT b.name, p.name AS plan, (SELECT count(*) FROM public.business_services s WHERE s.business_id = b.id) AS services,
--        (SELECT count(*) FROM public.business_products x WHERE x.business_id = b.id) AS products
--   FROM public.businesses b JOIN public.plans p ON p.id = b.current_plan_id
--  WHERE (p.max_services = 0 AND EXISTS (SELECT 1 FROM public.business_services s WHERE s.business_id = b.id))
--     OR (p.max_products = 0 AND EXISTS (SELECT 1 FROM public.business_products x WHERE x.business_id = b.id));
