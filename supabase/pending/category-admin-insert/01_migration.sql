-- ============================================================================
-- CATEGORIES: the DATABASE lets only ADMINS insert a category directly. Owners and admins still get "+ Add new category" in the forms:
-- the server function createCategory does the insert with the service role (bypasses this policy), after its own checks (name rule,
-- duplicates, 3 per 24 hours for non-admins). So nobody can skip those checks by calling the API directly.
--
-- WHY: the migration history flips between an admin-only INSERT policy (20260707062124) and a policy that lets ANY signed-in
-- user insert (20260709050651 / 20260709160346, "WITH CHECK (true)"). The last file in the folder is the permissive one, so on the
-- live database anybody signed in could add categories by calling the API directly, with no name rule and no limit. This closes that.
--
-- WHAT IT DOES: drops EVERY INSERT policy on public.categories (whatever its name), then creates one: INSERT for signed-in users
-- whose role is admin (public.has_role). SELECT / UPDATE / DELETE policies are not touched. No row is changed.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- Until this runs, the site's "+ Add new category" works as it should (it never uses the direct insert), but the direct API door is open.
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
