-- ============================================================================
-- CITY PUSH NOTIFICATIONS, PHASE 1: "New business in Ahmedabad: <name> (<category>)" for people who picked that city.
-- (Browser / web push now; the Android app joins in phase 2 with the same tables.)
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- Optional scheduler (Supabase pg_cron, for a Vercel Hobby plan): 04_schedule_pg_cron.sql, run AFTER this file.
-- This file REPLACES supabase/pending/ios-push (device_tokens): that one was never applied; do not run both.
--
-- What it creates
--   businesses.notify_city          admin switch "Notify users of this city" (default true). Only an admin can change it.
--   push_subscriptions              one row per browser / phone: its FCM token and the city it follows. NO policy for anon:
--                                   the server (service role) writes it; a signed-in person may only read / delete their own rows.
--   city_notify_queue               one row per business that became published (first time only), waiting to be announced.
--   city_notify_log                 what was sent: "3 single notifications a day per city" is counted from here, and the unique
--                                   indexes make double sending impossible.
--   enqueue trigger                 on businesses: published (not a restore from archived) + notify_city -> one queue row.
--   claim_city_notify_rows()        lets the sender take rows without two runs taking the same row (service role only).
--
-- Nothing here changes what visitors see on the website. Until the sender runs (needs the Firebase keys) the queue just
-- collects rows, which expire by themselves after 72 hours.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------- a) admin switch on the business
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS notify_city boolean NOT NULL DEFAULT true;

-- Only an admin (or the service role / SQL editor: no end-user JWT) may change the switch. An owner's insert / update keeps it.
CREATE OR REPLACE FUNCTION public.guard_business_notify_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.notify_city := true;
  ELSE
    NEW.notify_city := OLD.notify_city;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_guard_notify_city ON public.businesses;
CREATE TRIGGER businesses_guard_notify_city
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_notify_city();

-- ---------------------------------------------------------------- b) who gets the notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text NOT NULL,
  platform      text NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  -- city_key = the city's address part ("ahmedabad", "vadagam-aravalli"): the same key the website uses for city pages.
  city_key      text NOT NULL,
  city_label    text NOT NULL,
  lang          text,
  -- Phase 2 / account deletion: set when the person is signed in. Anonymous visitors have no account, so no user_id.
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled       boolean NOT NULL DEFAULT true,
  failure_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_token_key UNIQUE (token),
  CONSTRAINT push_subscriptions_token_len CHECK (char_length(token) BETWEEN 20 AND 4096)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_city_idx ON public.push_subscriptions (city_key) WHERE enabled;
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- anon: nothing at all. Signed-in: only read / delete their own rows (the server writes everything with the service role).
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------- c) what is waiting to be announced
CREATE TABLE IF NOT EXISTS public.city_notify_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One row per business, ever: restoring from archive or publishing again never announces it twice.
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  city        text,
  -- pending: waiting | sending: taken by a run | sent | held: over the daily limit, waits for the evening summary
  -- summarized | expired (72 h) | skipped (nobody follows that city, or not visible to the public) | failed
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'sending', 'sent', 'held', 'summarized', 'expired', 'skipped', 'failed')),
  attempts    integer NOT NULL DEFAULT 0,
  skip_reason text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  CONSTRAINT city_notify_queue_business_key UNIQUE (business_id)
);
CREATE INDEX IF NOT EXISTS city_notify_queue_status_idx ON public.city_notify_queue (status, created_at);

ALTER TABLE public.city_notify_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_notify_queue FROM anon, authenticated;
GRANT SELECT ON public.city_notify_queue TO authenticated;      -- the policy below lets only admins see rows
GRANT ALL ON public.city_notify_queue TO service_role;
DROP POLICY IF EXISTS "Admins can view the notification queue" ON public.city_notify_queue;
CREATE POLICY "Admins can view the notification queue"
  ON public.city_notify_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- d) what was sent (the daily limit is counted here)
CREATE TABLE IF NOT EXISTS public.city_notify_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_key    text NOT NULL,
  day         date NOT NULL,                 -- the India (IST) calendar day
  kind        text NOT NULL CHECK (kind IN ('single', 'summary')),
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  item_count  integer NOT NULL DEFAULT 1,    -- summary: how many businesses it covers
  sent        integer NOT NULL DEFAULT 0,
  failed      integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS city_notify_log_city_day_idx ON public.city_notify_log (city_key, day, kind);
-- a business is announced once; a city gets one summary a day (also guards two runs at the same moment)
CREATE UNIQUE INDEX IF NOT EXISTS city_notify_log_single_once ON public.city_notify_log (business_id) WHERE kind = 'single';
CREATE UNIQUE INDEX IF NOT EXISTS city_notify_log_summary_once ON public.city_notify_log (city_key, day) WHERE kind = 'summary';

ALTER TABLE public.city_notify_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_notify_log FROM anon, authenticated;
GRANT SELECT ON public.city_notify_log TO authenticated;
GRANT ALL ON public.city_notify_log TO service_role;
DROP POLICY IF EXISTS "Admins can view the notification log" ON public.city_notify_log;
CREATE POLICY "Admins can view the notification log"
  ON public.city_notify_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- e) a business became published -> one queue row
CREATE OR REPLACE FUNCTION public.enqueue_city_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  newly_published boolean;
BEGIN
  -- (OLD only exists on UPDATE, so it is read in its own branch.)
  IF TG_OP = 'INSERT' THEN
    newly_published := true;
  ELSE
    -- newly published (pending / rejected -> published). A restore from 'archived' is NOT news.
    newly_published := OLD.status IS DISTINCT FROM 'published' AND OLD.status IS DISTINCT FROM 'archived';
  END IF;

  IF newly_published
     AND NEW.status = 'published'
     AND NEW.notify_city
     AND NULLIF(btrim(COALESCE(NEW.city, '')), '') IS NOT NULL
  THEN
    INSERT INTO public.city_notify_queue (business_id, city)
    VALUES (NEW.id, NEW.city)
    ON CONFLICT (business_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS businesses_enqueue_city_notification ON public.businesses;
CREATE TRIGGER businesses_enqueue_city_notification
  AFTER INSERT OR UPDATE OF status ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_city_notification();

-- ---------------------------------------------------------------- f) the sender takes rows (never the same row twice)
CREATE OR REPLACE FUNCTION public.claim_city_notify_rows(p_limit integer DEFAULT 25)
RETURNS SETOF public.city_notify_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.city_notify_queue q
    WHERE q.expires_at > now()
      AND (q.status = 'pending' OR (q.status = 'sending' AND q.claimed_at < now() - interval '10 minutes'))
    ORDER BY q.created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.city_notify_queue q
     SET status = 'sending', claimed_at = now(), attempts = q.attempts + 1
    FROM picked
   WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_city_notify_rows(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_city_notify_rows(integer) TO service_role;

COMMIT;
