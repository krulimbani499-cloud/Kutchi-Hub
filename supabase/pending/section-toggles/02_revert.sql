-- Revert of 01_migration.sql: removes the two columns. The owners' ON / OFF choices are lost (they are not stored anywhere else).
-- After this the app goes back to "a section shows whenever it has items" (it treats a missing column as ON).
BEGIN;

ALTER TABLE public.businesses DROP COLUMN IF EXISTS show_services;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS show_products;

COMMIT;
