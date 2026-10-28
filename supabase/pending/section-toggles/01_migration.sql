-- ============================================================================
-- SECTION TOGGLES: each business decides whether its public profile shows the Services and / or the Products section.
--
--   businesses.show_services boolean NOT NULL DEFAULT false
--   businesses.show_products boolean NOT NULL DEFAULT false
--
-- The public page shows a section only when its switch is ON and the business has at least one ACTIVE item
-- (business_services.active / business_products.active, exactly the rows the public lists show).
--
-- BACKFILL: so that nothing changes on profiles that exist today, a business that already has at least one active service gets
-- show_services = true, and one with at least one active product gets show_products = true. Everything else starts OFF
-- (new businesses included: the owner switches a section on when they are ready).
--   - The backfill runs ONLY when the columns are created by this script. Running the file again later never switches anything
--     back on for an owner who turned a section off.
--   - The "update_businesses_updated_at" trigger is switched off for the backfill and back on straight after, so updated_at
--     (used as <lastmod> in the sitemap) does not move for hundreds of businesses.
--
-- WHO MAY CHANGE THEM: the same people who may change any other business column. Checked against the existing rules:
--   * RLS "Owners can update their own businesses" (edit-requires-plan): admin, or the owner while the business is not published
--     or has an active plan. No column list, so the two new columns are covered. Admins: always.
--   * guard_business_admin_columns (owner-transfer / edit-requires-plan) only locks owner_id, status, verified and the plan
--     columns for non-admins. The two new columns are NOT in that list on purpose: owners may edit them. Nothing to change there.
--   * No column-level GRANTs exist on public.businesses for UPDATE (only SELECT on phone / email is revoked for anon).
--   03_verify.sql re-checks all three.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- The app works without this file: until the columns exist every profile behaves as before (sections show when they have items)
-- and the two switches on the edit page cannot be saved (the form says the database update is missing).
-- ============================================================================
BEGIN;

DO $$
DECLARE
  created boolean := false;
  had_trigger boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'show_services'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN show_services boolean NOT NULL DEFAULT false;
    created := true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'show_products'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN show_products boolean NOT NULL DEFAULT false;
    created := true;
  END IF;

  IF created THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.businesses'::regclass AND tgname = 'update_businesses_updated_at' AND NOT tgisinternal
    ) INTO had_trigger;
    IF had_trigger THEN
      ALTER TABLE public.businesses DISABLE TRIGGER update_businesses_updated_at;
    END IF;

    UPDATE public.businesses b
       SET show_services = true
     WHERE EXISTS (SELECT 1 FROM public.business_services s WHERE s.business_id = b.id AND s.active);

    UPDATE public.businesses b
       SET show_products = true
     WHERE EXISTS (SELECT 1 FROM public.business_products p WHERE p.business_id = b.id AND p.active);

    IF had_trigger THEN
      ALTER TABLE public.businesses ENABLE TRIGGER update_businesses_updated_at;
    END IF;
  END IF;
END
$$;

COMMIT;
