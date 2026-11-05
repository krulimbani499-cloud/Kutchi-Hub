-- ============================================================================
-- BUSINESS ARCHIVE INFO: remember when, by whom and from which status a business was archived, so the admin "Restore" can suggest the
-- right status and the Archived list can show "Archived on ... by ...".
--
--   businesses.archived_from_status  text         the status it had just before it was archived ('published', 'pending', ...)
--   businesses.archived_at           timestamptz  when
--   businesses.archived_by           uuid         who (auth.users id; NULL when there was no signed-in person: SQL editor / service role)
--
-- A BEFORE UPDATE trigger fills them whenever status becomes 'archived' (the admin Archive button, the account deletion, SQL), and
-- clears them when the business leaves 'archived' again (a restore). Nothing else changes: no row is touched by this file, photos,
-- services, reviews, owner and plan are not involved.
--
-- Until this runs the site still works: Restore asks the admin for Published / Pending, and archives done after the site update are
-- remembered in the audit log (event business_archived) instead. Businesses archived BEFORE both have no record: the admin picks the status.
--
-- NOT related to the city notifications: the enqueue trigger (supabase/pending/city-push) already ignores a move out of 'archived'.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- ============================================================================
BEGIN;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS archived_from_status text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.track_business_archive()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status IS DISTINCT FROM 'archived' THEN
    NEW.archived_from_status := OLD.status;
    NEW.archived_at := now();
    NEW.archived_by := auth.uid();
  ELSIF OLD.status = 'archived' AND NEW.status IS DISTINCT FROM 'archived' THEN
    NEW.archived_from_status := NULL;
    NEW.archived_at := NULL;
    NEW.archived_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_track_archive ON public.businesses;
CREATE TRIGGER businesses_track_archive
BEFORE UPDATE OF status ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.track_business_archive();

COMMIT;
