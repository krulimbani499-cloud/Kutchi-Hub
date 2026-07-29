
CREATE TABLE public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  points integer NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX point_events_user_idx ON public.point_events(user_id, created_at DESC);
CREATE INDEX point_events_action_user_idx ON public.point_events(user_id, action);

GRANT SELECT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;

ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own point events"
ON public.point_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all point events"
ON public.point_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _action text, _points integer, _ref_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.point_events(user_id, action, points, ref_id)
  VALUES (_user_id, _action, _points, _ref_id);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_award_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 'review', 20, NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_award_on_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 'favorite', 5, NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_award_on_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    PERFORM public.award_points(NEW.owner_id, 'business_added', 50, NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER award_on_review AFTER INSERT ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_award_on_review();

CREATE TRIGGER award_on_favorite AFTER INSERT ON public.business_favorites
FOR EACH ROW EXECUTE FUNCTION public.tg_award_on_favorite();

CREATE TRIGGER award_on_business AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.tg_award_on_business();

INSERT INTO public.point_events(user_id, action, points, ref_id, created_at)
SELECT user_id, 'review', 20, id, created_at FROM public.business_reviews;

INSERT INTO public.point_events(user_id, action, points, ref_id, created_at)
SELECT user_id, 'favorite', 5, id, created_at FROM public.business_favorites;

INSERT INTO public.point_events(user_id, action, points, ref_id, created_at)
SELECT owner_id, 'business_added', 50, id, created_at FROM public.businesses WHERE owner_id IS NOT NULL;

CREATE OR REPLACE VIEW public.leaderboard_v AS
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
