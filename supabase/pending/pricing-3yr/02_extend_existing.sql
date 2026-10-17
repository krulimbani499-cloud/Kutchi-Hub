-- ============================================================================
-- OPTIONAL, RUN SEPARATELY (after 01_migration.sql, only if you want existing customers to get the 3 years):
-- extend ACTIVE Silver / Gold / Platinum subscriptions to  started_at + 36 months  when that is LATER than
-- their current expires_at.
--
-- STATUS: NOT APPLIED. The first statement is a read-only PREVIEW. The UPDATE below it is commented out on purpose:
-- run the preview, check the list, then uncomment the BEGIN..COMMIT block and run it.
--
-- "Active" = the same rule the app and the database use: status 'active', started_at <= now(), and
-- (expires_at IS NULL OR expires_at > now()). A subscription with expires_at NULL never expires, so there is nothing
-- to extend and it is skipped. Subscriptions on Enterprise, cancelled / expired / future-dated ones are not touched.
-- amount_paid is not changed (revenue totals stay as recorded). Nothing here edits plans.
-- The month arithmetic follows the database session time zone; the difference is at most hours, never days.
-- ============================================================================

-- ---- 1) PREVIEW (read-only): who would get which new expiry ------------------------------------------------
SELECT b.name                                       AS business,
       b.city,
       p.slug                                       AS plan,
       s.started_at,
       s.expires_at                                 AS old_expires_at,
       s.started_at + interval '36 months'          AS new_expires_at,
       (s.started_at + interval '36 months') - s.expires_at AS extra_time,
       s.id                                         AS subscription_id
  FROM public.business_subscriptions s
  JOIN public.plans      p ON p.id = s.plan_id
  JOIN public.businesses b ON b.id = s.business_id
 WHERE p.slug IN ('silver', 'gold', 'platinum')
   AND s.status = 'active'
   AND s.started_at <= now()
   AND s.expires_at IS NOT NULL
   AND s.expires_at > now()
   AND s.started_at + interval '36 months' > s.expires_at
 ORDER BY p.slug, s.expires_at;

-- ---- 2) THE UPDATE (inside a block comment, so it does nothing as it stands) --------------------------------
-- To run it: delete the line that says  /*  and the line that says  */  below, then run the file again.
-- It first saves the old expiry dates in public.pricing_3yr_expiry_backup, which 03_revert.sql uses to undo this.
/*
BEGIN;

CREATE TABLE IF NOT EXISTS public.pricing_3yr_expiry_backup AS
SELECT s.id AS subscription_id, s.expires_at AS old_expires_at, now() AS backed_up_at
  FROM public.business_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
 WHERE p.slug IN ('silver', 'gold', 'platinum')
   AND s.status = 'active'
   AND s.started_at <= now()
   AND s.expires_at IS NOT NULL
   AND s.expires_at > now()
   AND s.started_at + interval '36 months' > s.expires_at;

UPDATE public.business_subscriptions s
   SET expires_at = s.started_at + interval '36 months'
  FROM public.plans p
 WHERE p.id = s.plan_id
   AND p.slug IN ('silver', 'gold', 'platinum')
   AND s.status = 'active'
   AND s.started_at <= now()
   AND s.expires_at IS NOT NULL
   AND s.expires_at > now()
   AND s.started_at + interval '36 months' > s.expires_at;

COMMIT;
*/
