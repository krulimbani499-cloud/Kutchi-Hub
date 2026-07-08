
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE (
  user_id uuid,
  total_points integer,
  events_count integer,
  display_name text,
  avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pe.user_id,
    COALESCE(SUM(pe.points), 0)::integer AS total_points,
    COUNT(*)::integer AS events_count,
    p.display_name,
    p.avatar_url
  FROM public.point_events pe
  LEFT JOIN public.profiles p ON p.user_id = pe.user_id
  GROUP BY pe.user_id, p.display_name, p.avatar_url
  ORDER BY total_points DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100));
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO anon, authenticated;
