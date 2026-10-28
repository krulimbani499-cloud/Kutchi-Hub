-- ============================================================================
-- SEARCH LEADS: the "Get the list of top <category> - free" form on the search / category / city results pages.
-- A visitor leaves a name and a mobile number (and agrees to be contacted); the Kutchi Hub team calls them.
--
--   public.search_leads            one row per request.
--   RLS                           ANYONE can INSERT (also signed-out visitors: the form is public). ONLY ADMINS can SELECT.
--                                 Nobody can UPDATE or DELETE through the API (no policy, no grant).
--   rate limit (per IP)           BEFORE INSERT trigger: at most 5 requests per IP per hour. The IP is stored only as a hash.
--                                 The app sends the hash of the real visitor IP (ip_hash). A direct API call that omits it is
--                                 limited by the IP the database itself sees (the x-forwarded-for header of the request).
--   duplicate guard               the same mobile number for the same category within 10 minutes is accepted but not stored
--                                 again (a double tap must not create two leads).
--   validation                    the table itself refuses a bad mobile number, an empty name, no consent, or oversized text,
--                                 so a direct API call cannot fill it with rubbish either.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- Until this runs the app still works: the form shows a friendly "please call or WhatsApp us" message instead of saving, and the
-- admin "Search leads" tab says the table is not set up yet. So it is safe to deploy the code first.
-- Needs the existing public.has_role(uuid, app_role) function (it is used by every admin policy already).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.search_leads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  phone        text        NOT NULL,
  category_id  uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
  city         text,
  source_page  text,
  consent      boolean     NOT NULL,
  ip_hash      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_leads_name_len    CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT search_leads_phone_fmt   CHECK (phone ~ '^[6-9][0-9]{9}$'),            -- 10-digit Indian mobile, digits only
  CONSTRAINT search_leads_consent_yes CHECK (consent IS TRUE),
  CONSTRAINT search_leads_city_len    CHECK (city IS NULL OR char_length(city) <= 80),
  CONSTRAINT search_leads_source_len  CHECK (source_page IS NULL OR char_length(source_page) <= 300),
  CONSTRAINT search_leads_ip_len      CHECK (ip_hash IS NULL OR char_length(ip_hash) <= 128)
);

COMMENT ON TABLE public.search_leads IS
  'Visitors who asked the Kutchi Hub team for the list of top businesses of a category (search / category / city pages).';

CREATE INDEX IF NOT EXISTS search_leads_created_idx ON public.search_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS search_leads_ip_idx      ON public.search_leads (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS search_leads_phone_idx   ON public.search_leads (phone, created_at DESC);

-- ---- Row level security ------------------------------------------------------------------------------------------------
ALTER TABLE public.search_leads ENABLE ROW LEVEL SECURITY;

-- Table privileges: signed-out and signed-in visitors may only INSERT; only a signed-in (admin) session may SELECT.
REVOKE ALL ON public.search_leads FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.search_leads TO anon, authenticated;
GRANT SELECT ON public.search_leads TO authenticated;
GRANT ALL    ON public.search_leads TO service_role;

DROP POLICY IF EXISTS "anyone can request a list" ON public.search_leads;
CREATE POLICY "anyone can request a list"
  ON public.search_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent IS TRUE);

DROP POLICY IF EXISTS "admins read search leads" ON public.search_leads;
CREATE POLICY "admins read search leads"
  ON public.search_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- Rate limit per IP + duplicate guard ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_leads_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                     -- visitors cannot SELECT the table, but the trigger must count its rows
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headers jsonb;
  v_ip      text;
BEGIN
  -- Same number, same category, last 10 minutes: accept the request but do not store a second copy.
  IF EXISTS (
    SELECT 1 FROM public.search_leads l
     WHERE l.phone = NEW.phone
       AND l.category_id IS NOT DISTINCT FROM NEW.category_id
       AND l.created_at > now() - interval '10 minutes'
  ) THEN
    RETURN NULL;                     -- the INSERT quietly does nothing (the caller still gets "success")
  END IF;

  -- The app sends the hash of the visitor's IP. When it is missing (a direct API call), use the IP this database was called from.
  IF NEW.ip_hash IS NULL OR NEW.ip_hash = '' THEN
    BEGIN
      v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN others THEN
      v_headers := NULL;
    END;
    v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
    -- sha256 is built into PostgreSQL (no extension needed); it is the same hash the app computes: sha256("kh-search-leads:" + ip).
    NEW.ip_hash := CASE WHEN v_ip IS NULL THEN NULL ELSE encode(sha256(convert_to('kh-search-leads:' || v_ip, 'UTF8')), 'hex') END;
  END IF;

  IF NEW.ip_hash IS NOT NULL AND (
    SELECT count(*) FROM public.search_leads l
     WHERE l.ip_hash = NEW.ip_hash AND l.created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'search_leads_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.search_leads_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS search_leads_before_insert ON public.search_leads;
CREATE TRIGGER search_leads_before_insert
  BEFORE INSERT ON public.search_leads
  FOR EACH ROW EXECUTE FUNCTION public.search_leads_before_insert();

COMMIT;
