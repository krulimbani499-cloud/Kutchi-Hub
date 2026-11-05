-- ============================================================================
-- CATEGORIES: only ADMINS may add a category (the "+ Add new category" option in the admin Quick add form and the business form).
--
-- WHY: the migration history flips between an admin-only INSERT policy (20260707062124) and a policy that lets ANY signed-in
-- user insert (20260709050651 / 20260709160346, "WITH CHECK (true)"). The last file in the folder is the permissive one, so on the
-- live database an owner could add categories by calling the API directly. The server function now checks admin too; this makes the
-- database say the same thing.
--
-- WHAT IT DOES: drops EVERY INSERT policy on public.categories (whatever its name), then creates one: INSERT for signed-in users
-- whose role is admin (public.has_role). SELECT / UPDATE / DELETE policies are not touched. No row is changed.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- Until this runs, adding a category from the site already works for admins (and the server refuses everybody else).
-- ============================================================================
BEGIN;

DO $do$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.categories', pol.policyname);
  END LOOP;
END
$do$;

CREATE POLICY "Admins can create categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMIT;
