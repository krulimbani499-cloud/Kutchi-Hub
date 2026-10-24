-- READ-ONLY. Part 1: run BEFORE 01_migration.sql to see what is missing today (each row: does an index on those columns exist?).
SELECT t.tbl, t.cols,
       EXISTS (
         SELECT 1 FROM pg_index i
           JOIN pg_class c ON c.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = t.tbl
            AND (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
                   FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum) LIKE t.cols || '%'
       ) AS has_index
  FROM (VALUES
    ('businesses', 'owner_id'),
    ('businesses', 'category_id'),
    ('businesses', 'city'),
    ('businesses', 'status'),
    ('businesses', 'slug'),
    ('business_photos', 'business_id'),
    ('business_reviews', 'business_id'),
    ('business_reviews', 'user_id'),
    ('business_products', 'business_id'),
    ('business_services', 'business_id'),
    ('business_subscriptions', 'business_id'),
    ('business_claims', 'user_id'),
    ('notifications', 'user_id'),
    ('user_roles', 'user_id')
  ) AS t(tbl, cols)
 ORDER BY has_index, tbl, cols;

-- Part 2: run AFTER 01_migration.sql. Every row should say ok = true.
SELECT name AS index_name, to_regclass('public.' || name) IS NOT NULL AS ok
  FROM (VALUES
    ('idx_businesses_owner'), ('idx_business_photos_business'), ('idx_business_reviews_user'), ('idx_business_claims_user'),
    ('idx_businesses_published_order'), ('idx_businesses_name_trgm'), ('idx_businesses_city_trgm'),
    ('idx_business_products_name_trgm'), ('idx_business_services_name_trgm')
  ) AS v(name);

-- Part 3 (optional): is the search using the trigram index? Look for "Bitmap Index Scan on idx_businesses_name_trgm".
-- EXPLAIN SELECT id FROM public.businesses WHERE status = 'published' AND name ILIKE '%tiles%';
