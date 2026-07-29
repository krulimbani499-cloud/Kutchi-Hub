
-- Revoke SELECT on sensitive contact columns from anonymous users
REVOKE SELECT (phone, email) ON public.businesses FROM anon;

-- Revoke EXECUTE on trigger-only SECURITY DEFINER function from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.set_referral_code_on_profile() FROM anon, authenticated, PUBLIC;

-- Revoke EXECUTE on apply_referral_code from anon (auth-only via server function)
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text) FROM anon, PUBLIC;
