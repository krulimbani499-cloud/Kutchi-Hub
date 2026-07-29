
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, integer, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_award_on_review() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_award_on_favorite() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_award_on_business() FROM anon, authenticated, public;

DROP VIEW IF EXISTS public.leaderboard_v;
CREATE VIEW public.leaderboard_v
WITH (security_invoker = true) AS
SELECT
  pe.user_id,
  COALESCE(SUM(pe.points), 0)::integer AS total_points,
  COUNT(*)::integer AS events_count,
  p.display_name,
  p.avatar_url
FROM public.point_events pe
LEFT JOIN public.profiles p ON p.user_id = pe.user_id
GROUP BY pe.user_id, p.display_name, p.avatar_url;

GRANT SELECT ON public.leaderboard_v TO anon, authenticated;
