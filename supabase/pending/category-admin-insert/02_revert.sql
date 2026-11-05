-- Puts back the state of the last migration in the repo (20260709160346): any signed-in user may add a category.
-- Only run this if you really want owners to be able to insert categories directly. (The site's server function stays admin-only.)
BEGIN;

DROP POLICY IF EXISTS "Admins can create categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can create categories" ON public.categories;
CREATE POLICY "Authenticated users can create categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (true);

COMMIT;
