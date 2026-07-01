REVOKE EXECUTE ON FUNCTION public.create_profile_for_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_user() FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- Also revoke from public, then explicitly grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;