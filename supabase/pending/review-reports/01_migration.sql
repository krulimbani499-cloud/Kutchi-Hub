-- ============================================================================
-- REVIEW REPORTS (App Store guideline 1.2: user-generated content must be reportable and blockable).
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- Adds:
--   review_reports      one report per (review, reporter): reason spam / abusive / fake / other. RLS: a user inserts and
--                       reads only their own; admin reads and updates all.
--   review_hidden       reviews that an admin has hidden. Admin-only table (nobody else can write to it, so a review author
--                       or business owner cannot un-hide a review; business_reviews itself is NOT changed).
--   review_user_blocks  "Hide reviews from this user": blocker_id hides every review by blocked_user_id for that person only.
--   business_reviews    the SELECT policy now also hides hidden reviews (still visible to their author and to admins).
--                       Hidden reviews therefore drop out of rating averages as well (embedded business_reviews(rating)).
-- Existing tables (reports, business_reviews columns, triggers) are untouched.
-- ============================================================================
BEGIN;

-- 1) Reports -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid NOT NULL REFERENCES public.business_reviews(id) ON DELETE CASCADE,
  reporter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('spam', 'abusive', 'fake', 'other')),
  details      text CHECK (details IS NULL OR char_length(details) <= 500),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  admin_action text CHECK (admin_action IS NULL OR admin_action IN ('hidden', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  CONSTRAINT review_reports_one_per_user UNIQUE (review_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_reports_reporter ON public.review_reports (reporter_id);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_reports FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;

DROP POLICY IF EXISTS "Users can report a review" ON public.review_reports;
CREATE POLICY "Users can report a review" ON public.review_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'open'
    -- you cannot report your own review
    AND NOT EXISTS (SELECT 1 FROM public.business_reviews r WHERE r.id = review_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read their own review reports" ON public.review_reports;
CREATE POLICY "Users can read their own review reports" ON public.review_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all review reports" ON public.review_reports;
CREATE POLICY "Admins can read all review reports" ON public.review_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update review reports" ON public.review_reports;
CREATE POLICY "Admins can update review reports" ON public.review_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Hidden reviews (admin only) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_hidden (
  review_id uuid PRIMARY KEY REFERENCES public.business_reviews(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  note      text CHECK (note IS NULL OR char_length(note) <= 500)
);

ALTER TABLE public.review_hidden ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_hidden FROM anon;
GRANT SELECT, INSERT, DELETE ON public.review_hidden TO authenticated;
GRANT ALL ON public.review_hidden TO service_role;

DROP POLICY IF EXISTS "Admins manage hidden reviews" ON public.review_hidden;
CREATE POLICY "Admins manage hidden reviews" ON public.review_hidden
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Block / hide reviews from a user (per viewer) -----------------------------
CREATE TABLE IF NOT EXISTS public.review_user_blocks (
  blocker_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CONSTRAINT review_user_blocks_not_self CHECK (blocker_id <> blocked_user_id)
);

ALTER TABLE public.review_user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_user_blocks FROM anon;
GRANT SELECT, INSERT, DELETE ON public.review_user_blocks TO authenticated;
GRANT ALL ON public.review_user_blocks TO service_role;

DROP POLICY IF EXISTS "Users read their own blocks" ON public.review_user_blocks;
CREATE POLICY "Users read their own blocks" ON public.review_user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Users add their own blocks" ON public.review_user_blocks;
CREATE POLICY "Users add their own blocks" ON public.review_user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Users remove their own blocks" ON public.review_user_blocks;
CREATE POLICY "Users remove their own blocks" ON public.review_user_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- 4) Hidden reviews disappear from the public SELECT policy ---------------------
-- SECURITY DEFINER because anon has no EXECUTE on has_role() and no access to review_hidden.
CREATE OR REPLACE FUNCTION public.review_visible_to_caller(_review_id uuid, _author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.review_hidden h WHERE h.review_id = _review_id)
      OR _author_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.review_visible_to_caller(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_visible_to_caller(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Reviews visible for published or owned businesses" ON public.business_reviews;
CREATE POLICY "Reviews visible for published or owned businesses"
  ON public.business_reviews FOR SELECT
  USING (
    public.business_visible_to_caller(business_id)
    AND public.review_visible_to_caller(id, user_id)
  );

COMMIT;
