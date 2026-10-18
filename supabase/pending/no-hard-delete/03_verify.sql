-- ============================================================================
-- READ-ONLY checks for no-hard-delete. Safe to run any time (nothing is written).
-- After 01_migration.sql every "ok" below must be true.
-- ============================================================================

-- 1) The delete policies on businesses
SELECT polname AS policy, polcmd AS command, pg_get_expr(polqual, polrelid) AS using_clause
  FROM pg_policy
 WHERE polrelid = 'public.businesses'::regclass AND polcmd = 'd';

SELECT 'owner delete policy is gone' AS "check",
       NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.businesses'::regclass AND polname = 'Owners can delete their own businesses') AS ok
UNION ALL
SELECT 'admin-only delete policy exists and checks has_role(..., admin)',
       EXISTS (SELECT 1 FROM pg_policy
                WHERE polrelid = 'public.businesses'::regclass AND polname = 'Admins can delete businesses' AND polcmd = 'd'
                  AND pg_get_expr(polqual, polrelid) ILIKE '%has_role%' AND pg_get_expr(polqual, polrelid) ILIKE '%admin%'
                  AND pg_get_expr(polqual, polrelid) NOT ILIKE '%owner_id%')
UNION ALL
SELECT 'exactly one delete policy on businesses',
       (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.businesses'::regclass AND polcmd = 'd') = 1
UNION ALL
SELECT 'no CHECK constraint on status blocks archived',
       NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.businesses'::regclass AND contype = 'c'
                      AND pg_get_constraintdef(oid) ILIKE '%status%' AND pg_get_constraintdef(oid) NOT ILIKE '%archived%')
UNION ALL
SELECT 'status is not an enum, or the enum has archived',
       NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
                    WHERE a.attrelid = 'public.businesses'::regclass AND a.attname = 'status' AND t.typtype = 'e')
       OR EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid JOIN pg_enum e ON e.enumtypid = t.oid
                   WHERE a.attrelid = 'public.businesses'::regclass AND a.attname = 'status' AND e.enumlabel = 'archived');

-- 2) Public reads still only see published (archived must not be listed here)
SELECT polname AS select_policy, pg_get_expr(polqual, polrelid) AS using_clause
  FROM pg_policy
 WHERE polrelid = 'public.businesses'::regclass AND polcmd = 'r';

-- 3) How many businesses are in each status
SELECT status, count(*) FROM public.businesses GROUP BY status ORDER BY status;
