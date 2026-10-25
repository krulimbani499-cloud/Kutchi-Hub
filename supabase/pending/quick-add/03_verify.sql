-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'lead_source: text, nullable' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses'
                AND column_name = 'lead_source' AND data_type = 'text' AND is_nullable = 'YES') AS ok
UNION ALL
SELECT '(only right after 01 runs) no business has a source yet', NOT EXISTS (SELECT 1 FROM public.businesses WHERE lead_source IS NOT NULL);

-- For information: leads per source.
SELECT coalesce(lead_source, '(none)') AS source, count(*) AS businesses FROM public.businesses GROUP BY 1 ORDER BY 2 DESC;
