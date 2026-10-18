-- ============================================================================
-- Review-author names for the public business page, WITHOUT giving anon access to public.profiles.
-- Fixes the repeated  42501 permission denied for table profiles  that the ANON role causes in getBusinessBySlug
-- (src/lib/businesses.functions.ts reads profiles with the public key; anon has no SELECT on profiles since 20260707062124).
--
-- STATUS: NOT APPLIED / NOT RUN. Needs a small code change too (call this function instead of from("profiles")); not made yet.
-- Exposes only display_name + avatar_url, and only for users who wrote a review on the given business. No email, no phone.
-- Revert: DROP FUNCTION public.review_authors(uuid);
-- ============================================================================
CREATE OR REPLACE FUNCTION public.review_authors(_business_id uuid)
RETURNS TABLE (user_id uuid, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
    FROM public.profiles p
   WHERE p.user_id IN (SELECT r.user_id FROM public.business_reviews r WHERE r.business_id = _business_id)
     AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.status = 'published');
$$;

REVOKE EXECUTE ON FUNCTION public.review_authors(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.review_authors(uuid) TO anon, authenticated;
