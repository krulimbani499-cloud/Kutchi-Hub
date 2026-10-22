-- Revert of 01_migration.sql. Deletes every saved push token (people just register again the next time they open the app).
DROP TABLE IF EXISTS public.device_tokens;
