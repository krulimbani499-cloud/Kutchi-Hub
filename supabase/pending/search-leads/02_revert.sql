-- Revert of 01_migration.sql: removes the search_leads table (with every lead in it), its trigger and its function.
-- EXPORT THE LEADS FIRST (admin panel > Search leads > Export CSV): the rows are not stored anywhere else.
-- After this the app goes back to "the form says: please call or WhatsApp us" and the admin tab says the table is not set up.
BEGIN;

DROP TRIGGER IF EXISTS search_leads_before_insert ON public.search_leads;
DROP TABLE IF EXISTS public.search_leads;
DROP FUNCTION IF EXISTS public.search_leads_before_insert();

COMMIT;
