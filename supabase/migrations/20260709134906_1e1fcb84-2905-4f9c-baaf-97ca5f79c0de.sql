
-- 1. Remove the permissive INSERT policy on categories
DROP POLICY IF EXISTS "Authenticated users can create categories" ON public.categories;

-- 2. Revoke EXECUTE on trigger-only / internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_designated_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_enquiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_review_update_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_user_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_discount_claim_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_business_verified_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_category_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_banner_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_award_on_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_award_on_favorite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_award_on_business() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_claimant_on_claim_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_referral_code_on_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;

-- 3. Keep RPC-callable functions accessible to the correct roles
-- has_role is called from RLS policies; authenticated needs EXECUTE
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;

-- apply_referral_code: RPC used by signed-in users only
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

-- get_leaderboard: public read RPC
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO anon, authenticated;
