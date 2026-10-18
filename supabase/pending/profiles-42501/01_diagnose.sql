-- ============================================================================
-- DIAGNOSE "permission denied for table profiles" (42501) - READ-ONLY. Nothing here changes data or schema.
-- STATUS: NOT RUN. Paste into the Supabase SQL editor and send back the 6 result sets.
-- ============================================================================

-- 1) Who may touch public.profiles right now? (repo says: authenticated = all ops, service_role = all, anon = nothing)
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'profiles'
 GROUP BY grantee ORDER BY grantee;

-- 2) Every RLS policy anywhere whose condition mentions profiles (a policy that reads profiles runs as the caller)
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE qual ILIKE '%profiles%' OR with_check ILIKE '%profiles%';

-- 3) Every function that mentions profiles, and whether it is SECURITY DEFINER (prosecdef = true) or INVOKER (false)
SELECT p.oid::regprocedure AS function, p.prosecdef AS security_definer, pg_get_userbyid(p.proowner) AS owner
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND pg_get_functiondef(p.oid) ILIKE '%profiles%';

-- 4) Every trigger on the add-service tables and the function it calls
SELECT c.relname AS table_name, t.tgname AS trigger, t.tgenabled, t.tgfoid::regproc AS function
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal AND c.relname IN ('business_services', 'businesses', 'business_photos', 'business_products', 'profiles');

-- 5) Views that read profiles (a security_invoker view runs as the caller; a normal view runs as its owner)
SELECT c.relname AS view, c.reloptions, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'v' AND pg_get_viewdef(c.oid) ILIKE '%profiles%';

-- 6) Is RLS on and which policies exist on business_services itself?
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_services';
