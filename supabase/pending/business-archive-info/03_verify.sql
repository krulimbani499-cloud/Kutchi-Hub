-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'the three archive columns exist' AS check,
       (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
         AND column_name IN ('archived_from_status', 'archived_at', 'archived_by')) = 3 AS ok
UNION ALL
SELECT 'trigger businesses_track_archive exists',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'businesses_track_archive' AND tgrelid = 'public.businesses'::regclass AND NOT tgisinternal)
UNION ALL
SELECT 'status "archived" is allowed (no CHECK that forbids it) - see supabase/pending/no-hard-delete if this is false',
       NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.businesses'::regclass AND contype = 'c'
                    AND pg_get_constraintdef(oid) ILIKE '%status%' AND pg_get_constraintdef(oid) NOT ILIKE '%archived%');

-- Archived businesses and what is known about them (info only):
-- SELECT name, status, archived_from_status, archived_at, archived_by FROM public.businesses WHERE status = 'archived' ORDER BY archived_at DESC NULLS LAST;
