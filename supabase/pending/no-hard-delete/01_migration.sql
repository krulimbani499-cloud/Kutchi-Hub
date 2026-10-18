-- ============================================================================
-- NO MORE HARD DELETES OF BUSINESSES.
-- Deleting a business also deletes its subscriptions and payment history (business_subscriptions.business_id is
-- ON DELETE CASCADE, and so are reviews, photos, products, services, enquiries, favourites ...). An admin did that
-- to a paid listing by mistake. The app now ARCHIVES instead (businesses.status = 'archived') and keeps every row.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
--
-- 1) 'archived' must be an allowed status.
--    In the repo migrations businesses.status is a plain  text NOT NULL DEFAULT 'published'  (no enum, no CHECK), so
--    'archived' already fits and nothing needs changing. The live column may differ, so the block below looks at it:
--      - a CHECK constraint that mentions status       -> recreated as  (<the original rule>) OR status = 'archived'
--                                                         (everything it allowed before is still allowed; nothing else changes)
--      - an enum type                                  -> 'archived' is added to the enum
--      - plain text, no constraint                     -> nothing to do
--
-- 2) DELETE policy: "Owners can delete their own businesses" (owner OR admin) is dropped and replaced by an
--    admin-only policy. Owners can no longer delete a business at all, not even through the API.
--    (Hidden from the public already: the anon / authenticated SELECT policies only show status = 'published', plus
--     the owner's own and admin's everything, so an archived business disappears from every public query.)
-- ============================================================================
BEGIN;

DO $$
DECLARE
  c        record;
  enum_ty  text;
  rule     text;
BEGIN
  -- a) CHECK constraint(s) on businesses.status
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = 'public.businesses'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    IF c.def NOT ILIKE '%archived%' THEN
      -- pg_get_constraintdef gives  CHECK (<rule>)  - keep <rule> exactly and add the new status next to it.
      rule := substring(c.def from '^CHECK \((.*)\)(?: NOT VALID)?$');
      IF rule IS NULL OR rule = '' THEN RAISE EXCEPTION 'Could not read the status CHECK constraint %: %', c.conname, c.def; END IF;
      EXECUTE format('ALTER TABLE public.businesses DROP CONSTRAINT %I', c.conname);
      EXECUTE format('ALTER TABLE public.businesses ADD CONSTRAINT %I CHECK ((%s) OR status = %L)', c.conname, rule, 'archived');
      RAISE NOTICE 'status CHECK constraint % now allows archived', c.conname;
    END IF;
  END LOOP;

  -- b) enum type
  SELECT t.typname INTO enum_ty
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
   WHERE a.attrelid = 'public.businesses'::regclass AND a.attname = 'status' AND t.typtype = 'e';
  IF enum_ty IS NOT NULL THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', enum_ty, 'archived');
    RAISE NOTICE 'enum % now has the value archived', enum_ty;
  END IF;
END
$$;

-- 2) Only an admin may delete a business.
DROP POLICY IF EXISTS "Owners can delete their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can delete businesses" ON public.businesses;
CREATE POLICY "Admins can delete businesses"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMIT;
