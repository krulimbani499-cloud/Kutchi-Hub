-- ============================================================================
-- REVERT of no-hard-delete/01_migration.sql. NOT APPLIED.
-- Puts back the original DELETE policy (owner OR admin may delete) - the thing that allowed the accidental cascade
-- delete. Think twice before running it.
--
-- Not reverted, on purpose: the status constraint / enum. If 01 had to widen a CHECK constraint it keeps allowing
-- 'archived' (harmless), and an enum value cannot be removed in PostgreSQL. Archived businesses stay archived;
-- to publish them again use the Restore button in Admin -> Businesses, or:
--   UPDATE public.businesses SET status = 'published' WHERE status = 'archived';
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "Admins can delete businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners can delete their own businesses" ON public.businesses;
CREATE POLICY "Owners can delete their own businesses"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMIT;
