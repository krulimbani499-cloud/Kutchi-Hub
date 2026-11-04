-- ============================================================================
-- OPTIONAL: run the sender only in the DAYTIME (India 08:00 - 21:30 = UTC 02:30 - 16:00) instead of all day and night.
-- Saves about 60 of the 144 calls a day (every call is a Vercel function run), and loses nothing: the sender itself does nothing
-- between 21:00 and 08:00 India time (quiet hours, see src/lib/city-push.ts), so those night calls only cost CPU.
--
-- STATUS: NOT APPLIED. Run it yourself in the Supabase SQL editor, AFTER 04_schedule_pg_cron.sql (it reuses the two Vault secrets
-- city_push_url and city_push_cron_secret that file created, and replaces its all-day job).
--
-- pg_cron uses the UTC clock and cannot say "02:30 to 16:00" in one line, so the day is three jobs:
--   city-push-dispatch-0230   02:30, 02:40, 02:50 UTC     (08:00 - 08:20 India)
--   city-push-dispatch-day    every 10 min, 03:00 - 15:50 UTC   (08:30 - 21:20 India)
--   city-push-dispatch-1600   16:00 UTC                   (21:30 India)
-- Note: the sender starts its quiet hours at 21:00 India time, so the calls from 21:00 to 21:30 India answer "quiet_hours" at once
-- (they cost almost nothing). The last call that can send is the one at 20:50 India (15:20 UTC).
-- ============================================================================
BEGIN;

DO $do$
DECLARE
  cmd text := $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'city_push_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'city_push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'city_push_url')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'city_push_cron_secret') THEN
    RAISE EXCEPTION 'Run 04_schedule_pg_cron.sql first: the Vault secrets city_push_url / city_push_cron_secret do not exist.';
  END IF;

  -- the all-day job of 04_schedule_pg_cron.sql goes away (only if it exists)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'city-push-dispatch') THEN
    PERFORM cron.unschedule('city-push-dispatch');
  END IF;

  -- scheduling a name that already exists just replaces that job, so this file can be run again
  PERFORM cron.schedule('city-push-dispatch-0230', '30-59/10 2 * * *', cmd);
  PERFORM cron.schedule('city-push-dispatch-day',  '*/10 3-15 * * *',  cmd);
  PERFORM cron.schedule('city-push-dispatch-1600', '0 16 * * *',       cmd);
END
$do$;

COMMIT;

-- Check (3 rows, all active):
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'city-push-dispatch%' ORDER BY jobname;
-- Answers of the last calls:
-- SELECT id, status_code, error_msg, created FROM net._http_response ORDER BY created DESC LIMIT 10;

-- ---------------------------------------------------------------- go back to "every 10 minutes, day and night"
-- SELECT cron.unschedule('city-push-dispatch-0230');
-- SELECT cron.unschedule('city-push-dispatch-day');
-- SELECT cron.unschedule('city-push-dispatch-1600');
-- then run the "3) every 10 minutes" block of 04_schedule_pg_cron.sql again.
