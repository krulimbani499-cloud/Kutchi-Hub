-- ============================================================================
-- OPTIONAL: the scheduler, for a Vercel HOBBY plan (Hobby cron runs once a day at most). Supabase calls the sender every 10 minutes.
-- Skip this file if you are on Vercel PRO and use Vercel Cron instead (see README.md).
--
-- STATUS: NOT APPLIED. Run it yourself, after 01_migration.sql AND after the site with /api/push/dispatch is deployed.
-- The secret is kept in Supabase Vault, never in this file: replace the two <...> values by hand in the SQL editor, and do not paste
-- the real CRON_SECRET anywhere else (not in chat, not in git). It must be the same value as the CRON_SECRET env on Vercel.
-- ============================================================================

-- 1) extensions (Dashboard > Database > Extensions shows the same switches)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2) the two secrets (run once; use vault.update_secret(...) to change them later)
SELECT vault.create_secret('<the same CRON_SECRET as on Vercel>', 'city_push_cron_secret', 'Bearer secret of /api/push/dispatch');
SELECT vault.create_secret('https://www.kutchihub.com/api/push/dispatch', 'city_push_url', 'The sender address');

-- 3) every 10 minutes (UTC clock; the sender itself works in India time: quiet hours 21:00-08:00, evening summary from 19:00)
SELECT cron.schedule(
  'city-push-dispatch',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'city_push_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'city_push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);

-- Check: SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'city-push-dispatch';
-- Answers of the last calls: SELECT id, status_code, error_msg, created FROM net._http_response ORDER BY created DESC LIMIT 10;

-- ---------------------------------------------------------------- stop / remove the scheduler
-- SELECT cron.unschedule('city-push-dispatch');
-- DELETE FROM vault.secrets WHERE name IN ('city_push_cron_secret', 'city_push_url');
