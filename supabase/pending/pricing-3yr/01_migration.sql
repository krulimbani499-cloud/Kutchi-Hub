-- ============================================================================
-- NEW PRICING: Silver / Gold / Platinum become 3-YEAR plans. Enterprise is unchanged (Rs 25,000 / 1 year).
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 03_revert.sql. Verify: 04_verify.sql.
-- Run order: this file first. 02_extend_existing.sql (separate, optional) afterwards.
-- The app works before AND after this file: until billing_period_months exists every plan is treated as 12 months
-- and the current limits / texts are read from the plans table as they are today.
--
-- WHERE THE PRICE LIVES
--   plans.price_yearly is the one price the app reads and shows (PlanCard, revenue fallback "plan price", the
--   assign-plan form). Its name is legacy: it now means "the price for ONE BILLING PERIOD". For the 3-year plans it
--   holds the price of the whole 3 years (500 / 1500 / 5000) and the new column billing_period_months (36) says how
--   long that covers. Nothing is divided: revenue totals keep using the amount actually paid.
--   plans.price_monthly (only the admin plan list and a fallback read it) is set to the per-month equivalent
--   ROUND(price / 36) = 14 / 42 / 139, so "Rs/mo" is truthful. Enterprise keeps 25000 / 25000 (12 months).
--
-- WHAT CHANGES (only the columns listed; max_events, unlimited_leads, priority_support, is_popular,
-- description, colour, icon and every other column are left exactly as they are)
--   silver    36 months  Rs 500   photos 5   products 0   services 0   verified  analytics  no featured / top ranking
--             banner slots 0   catalog no
--   gold      36 months  Rs 1,500 photos 20  products 10  services 10  + featured listing, top ranking
--             banner slots 1   catalog yes
--   platinum  36 months  Rs 5,000 photos 40  products 999 services 999 (= unlimited)  + featured, top ranking
--             banner slots 3   catalog yes      (the homepage Spotlight is by tier, unchanged)
--   plans.features (jsonb array of strings, same type as today) gets the new texts.
--
-- A plan with max_products / max_services = 0 blocks NEW products / services (the existing database trigger
-- enforce_business_plan_limit treats 0 as "none allowed"); what a business already saved is NOT deleted.
-- Rows are matched by id AND slug; the migration aborts (nothing applied) unless exactly 1 row is updated each time.
-- ============================================================================
BEGIN;

-- 1) How many months the plan price covers. Existing rows (and any new plan) default to 12 = a yearly plan.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS billing_period_months integer NOT NULL DEFAULT 12;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.plans'::regclass AND conname = 'plans_billing_period_months_check'
  ) THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_billing_period_months_check CHECK (billing_period_months BETWEEN 1 AND 120);
  END IF;
END
$$;

-- Same column the catalog-gold-only migration adds. IF NOT EXISTS: a no-op when that migration was already applied.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS allow_catalog boolean NOT NULL DEFAULT true;

-- 2) The three 3-year plans.
DO $$
DECLARE n integer;
BEGIN
  -- SILVER
  UPDATE public.plans SET
    billing_period_months = 36,
    price_yearly          = 500,
    price_monthly         = 14,
    max_photos            = 5,
    max_products          = 0,
    max_services          = 0,
    featured_listing      = false,
    verified_badge        = true,
    top_ranking           = false,
    analytics_access      = true,
    banner_ad_slots       = 0,
    allow_catalog         = false,
    features              = '["Verified badge","Up to 5 photos","Basic analytics (views & calls)","Call, WhatsApp & Directions buttons"]'::jsonb
  WHERE id = '7f66fb32-db17-4cbc-bc2a-57f9e2f61754' AND slug = 'silver';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected to update exactly 1 Silver plan row, updated % - nothing applied', n; END IF;

  -- GOLD
  UPDATE public.plans SET
    billing_period_months = 36,
    price_yearly          = 1500,
    price_monthly         = 42,
    max_photos            = 20,
    max_products          = 10,
    max_services          = 10,
    featured_listing      = true,
    verified_badge        = true,
    top_ranking           = true,
    analytics_access      = true,
    banner_ad_slots       = 1,
    allow_catalog         = true,
    features              = '["Everything in Silver","Featured listing","Top ranking in category","Up to 20 photos","10 products & services","1 banner ad","Product catalog (PDF)"]'::jsonb
  WHERE id = 'c3e0b34e-a7ad-40b6-a887-9e9131033178' AND slug = 'gold';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected to update exactly 1 Gold plan row, updated % - nothing applied', n; END IF;

  -- PLATINUM
  UPDATE public.plans SET
    billing_period_months = 36,
    price_yearly          = 5000,
    price_monthly         = 139,
    max_photos            = 40,
    max_products          = 999,
    max_services          = 999,
    featured_listing      = true,
    verified_badge        = true,
    top_ranking           = true,
    analytics_access      = true,
    banner_ad_slots       = 3,
    allow_catalog         = true,
    features              = '["Everything in Gold","Homepage Spotlight in your city","Up to 40 photos","Unlimited products & services","3 homepage banner ads","3 event/offer promotions","Custom promotions","Product catalog (PDF)"]'::jsonb
  WHERE id = '2eaf997d-2f9f-40e9-8491-721be0aa4eef' AND slug = 'platinum';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected to update exactly 1 Platinum plan row, updated % - nothing applied', n; END IF;

  -- ENTERPRISE: must exist, must stay a 12-month Rs 25,000 plan. Nothing is changed.
  SELECT count(*) INTO n FROM public.plans
   WHERE id = '57e87ca2-9419-416b-822f-9a3aa0e8ba44' AND slug = 'enterprise'
     AND billing_period_months = 12 AND price_yearly = 25000;
  IF n <> 1 THEN RAISE EXCEPTION 'Enterprise plan row is not as expected (1 row, 12 months, 25000) - nothing applied'; END IF;
END
$$;

COMMIT;
