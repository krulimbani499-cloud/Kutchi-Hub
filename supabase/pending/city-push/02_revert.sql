-- Revert of 01_migration.sql (and of 04_schedule_pg_cron.sql if you ran it: unschedule first, see the bottom of that file).
-- Deletes every saved push subscription, the queue and the log. The `notify_city` column is dropped too.
BEGIN;
DROP TRIGGER IF EXISTS businesses_enqueue_city_notification ON public.businesses;
DROP TRIGGER IF EXISTS businesses_guard_notify_city ON public.businesses;
DROP FUNCTION IF EXISTS public.enqueue_city_notification();
DROP FUNCTION IF EXISTS public.guard_business_notify_city();
DROP FUNCTION IF EXISTS public.claim_city_notify_rows(integer);
DROP TABLE IF EXISTS public.city_notify_log;
DROP TABLE IF EXISTS public.city_notify_queue;
DROP TABLE IF EXISTS public.push_subscriptions;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS notify_city;
COMMIT;
