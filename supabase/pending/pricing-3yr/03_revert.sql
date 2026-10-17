-- ============================================================================
-- REVERT of pricing-3yr. NOT APPLIED. Two independent parts:
--   PART B first (only if you ran 02_extend_existing.sql): put the old expiry dates back from the backup table.
--   PART A second: put the old plan rows back and drop billing_period_months.
-- Deploy the previous app code first, or leave the current code: it works with or without the column.
-- Not reverted (not touched by the migration): allow_catalog (the column may belong to catalog-gold-only) and every
-- column the migration did not list.
-- ============================================================================

-- ---- PART B: restore subscription expiry dates (inside a block comment; run only if 02 was applied) --------
-- To run it: delete the line that says  /*  and the line that says  */  below.
/*
BEGIN;
UPDATE public.business_subscriptions s
   SET expires_at = b.old_expires_at
  FROM public.pricing_3yr_expiry_backup b
 WHERE b.subscription_id = s.id;
DROP TABLE public.pricing_3yr_expiry_backup;
COMMIT;
*/

-- ---- PART A: restore the plans ---------------------------------------------------------------------------------
-- Old values are the live ones read before this change (prices 499 / 1499 / 4999, price_monthly = price_yearly).
BEGIN;

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.plans SET
    price_yearly = 499, price_monthly = 499,
    max_photos = 15, max_products = 10, max_services = 10,
    featured_listing = false, verified_badge = true, top_ranking = false, analytics_access = true,
    banner_ad_slots = 0, allow_catalog = false,
    features = '["Everything in Free","Verified badge","Up to 15 photos","10 products & services","3 events per month","Basic analytics"]'::jsonb
  WHERE id = '7f66fb32-db17-4cbc-bc2a-57f9e2f61754' AND slug = 'silver';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected to restore exactly 1 Silver row, got % - nothing reverted', n; END IF;

  UPDATE public.plans SET
    price_yearly = 1499, price_monthly = 1499,
    max_photos = 40, max_products = 999, max_services = 999,
    featured_listing = true, verified_badge = true, top_ranking = true, analytics_access = true,
    banner_ad_slots = 1, allow_catalog = true,
    features = '["Everything in Silver","Featured listing","Up to 40 photos","Unlimited products & services","Top ranking in category","Unlimited leads","Priority support","1 banner ad slot"]'::jsonb
  WHERE id = 'c3e0b34e-a7ad-40b6-a887-9e9131033178' AND slug = 'gold';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected to restore exactly 1 Gold row, got % - nothing reverted', n; END IF;

  UPDATE public.plans SET
    price_yearly = 4999, price_monthly = 4999,
    max_photos = 999, max_products = 999, max_services = 999,
    featured_listing = true, verified_badge = true, top_ranking = true, analytics_access = true,
    banner_ad_slots = 3, allow_catalog = true,
    features = '["Everything in Gold","#1 spot in category","Unlimited photos","Unlimited events","Homepage feature","3 banner ad slots","Dedicated account manager","Custom promotions"]'::jsonb
  WHERE id = '2eaf997d-2f9f-40e9-8491-721be0aa4eef' AND slug = 'platinum';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected to restore exactly 1 Platinum row, got % - nothing reverted', n; END IF;
END
$$;

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_billing_period_months_check;
ALTER TABLE public.plans DROP COLUMN IF EXISTS billing_period_months;

COMMIT;
