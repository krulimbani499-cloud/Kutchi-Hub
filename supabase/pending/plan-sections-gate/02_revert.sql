BEGIN;
DROP TRIGGER IF EXISTS enforce_service_plan_update ON public.business_services;
DROP TRIGGER IF EXISTS enforce_product_plan_update ON public.business_products;
DROP FUNCTION IF EXISTS public.enforce_plan_section_update();
COMMIT;
