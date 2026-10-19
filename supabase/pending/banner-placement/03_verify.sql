-- READ-ONLY. Run after 01_migration.sql. Every row should say ok = true.
SELECT 'placement column: text, NOT NULL, default home_top' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'banner_ads' AND column_name = 'placement'
                  AND data_type = 'text' AND is_nullable = 'NO' AND column_default LIKE '%home_top%') AS ok
UNION ALL
SELECT 'show_all_cities column: boolean, NOT NULL, default false',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'banner_ads' AND column_name = 'show_all_cities'
                  AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'false')
UNION ALL
SELECT 'CHECK allows only home_top / home_middle',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conrelid = 'public.banner_ads'::regclass AND conname = 'banner_ads_placement_check'
                  AND pg_get_constraintdef(oid) LIKE '%home_top%' AND pg_get_constraintdef(oid) LIKE '%home_middle%')
UNION ALL
SELECT '(only right after 01 runs) every banner is still a top banner that is not all-cities',
       NOT EXISTS (SELECT 1 FROM public.banner_ads WHERE placement <> 'home_top' OR show_all_cities);

-- For information: how many banners per placement now.
SELECT placement, show_all_cities, count(*) AS banners FROM public.banner_ads GROUP BY 1, 2 ORDER BY 1, 2;
