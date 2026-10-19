-- Revert of 02_migration.sql: removes the unique index (the (slug, city) rule from the original schema stays).
DROP INDEX IF EXISTS public.businesses_slug_unique;
