-- ============================================================================
-- CATEGORY CREATOR: remember WHO added each category (owners and admins can add one from the business form / Quick add).
--
--   public.categories.created_by   uuid, nullable, -> auth.users(id), ON DELETE SET NULL. NULL = an original category (or one made
--                                  before this column existed). Written ONLY by the server function createCategory (service role).
--   public.categories.created_at   already exists (timestamptz, default now()): the "when".
--
-- It is used for (1) the limit of 3 new categories per 24 hours for everybody who is not an admin, counted by the server function,
-- and (2) the "Created by" label on the admin Categories page, so the admin can see which categories a client made and rename / delete them.
--
-- NO RLS CHANGE HERE. Category inserts stay admin-only in the database (run supabase/pending/category-admin-insert/01_migration.sql
-- too, in any order): the site adds categories for owners through the server function, with the service role, after its checks.
-- Until THIS file runs: admins can still add categories (without a creator), owners get "Adding categories needs a database update first".
--
-- Note: categories are readable by everybody, so created_by (a user id, no name / e-mail) is part of what the public API returns for a
-- category. The names / e-mails shown to the admin come from a server function that only admins can call.
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- ============================================================================
BEGIN;

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- the daily-limit count: "categories made by this person since ..."
CREATE INDEX IF NOT EXISTS idx_categories_created_by_at ON public.categories (created_by, created_at) WHERE created_by IS NOT NULL;

COMMIT;
