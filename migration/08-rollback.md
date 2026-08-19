# Rollback plan

The old Lovable Cloud backend is never written to during this migration, so at
every stage rollback means "go back to using it".

## Stage 1 — Before any Vercel env change

Nothing is live on the new backend. Just fix and retry.

To wipe the new project's data and start the load again:

```sql
-- Run on the NEW database only. Reverse dependency order.
BEGIN;
SET session_replication_role = replica;
TRUNCATE TABLE
  public.audit_logs, public.reports, public.discount_claims, public.referrals,
  public.point_events, public.notifications, public.events, public.banner_ads,
  public.business_events, public.business_favorites, public.business_claims,
  public.business_enquiries, public.business_reviews,
  public.business_subscriptions, public.business_services,
  public.business_products, public.business_photos, public.businesses,
  public.user_roles, public.profiles, public.ad_slots, public.categories,
  public.plans
RESTART IDENTITY CASCADE;
SET session_replication_role = origin;
COMMIT;
```

Then re-run `03-import.sh`.

To remove the recreated auth users as well (only if you need a clean slate —
this also clears the auto-created profile/role rows):

```bash
# lists then deletes every user in the NEW project — destructive, new project only
psql "$NEW_DB_URL" -c "select id, email from auth.users order by created_at"
```
Delete them from Authentication → Users in your dashboard, or via the Admin API.

## Stage 2 — Vercel env switched, DNS not yet moved

Recovery time: a few minutes.

1. Vercel → Settings → Environment Variables → restore the Lovable Cloud
   values recorded in `07-env.md`.
2. Deployments → Redeploy **without build cache**.
3. Confirm the site loads and a business page renders data.

No data is lost: everything written in that window went to the new backend and
is still there.

## Stage 3 — After DNS cutover

Recovery time: DNS TTL (keep TTL at 300s for the cutover week).

1. Point DNS back to the previous host.
2. Restore the old env vars and redeploy (Stage 2 steps).
3. Rescue anything written to the new backend during the window:

```bash
./09-delta-sync.sh --since '<cutover timestamp, e.g. 2026-08-20 10:00:00+00>' --reverse
```

This copies rows created after the cutover time from the new backend back to
the old one, using `ON CONFLICT DO NOTHING` so nothing is overwritten.

Note: `--reverse` needs `OLD_DB_URL`, which Lovable Cloud may not give you. If
you don't have it, export the delta CSVs and re-enter those few rows through
the app UI instead — with current volumes that is a handful of records.

## Stage 4 — Storage rollback

Storage copy is additive; the old bucket is untouched. Rolling back needs no
storage action. Files uploaded to the new bucket during the window can be
pulled back by running `06-storage-copy.ts` with `OLD_*` and `NEW_*` values
swapped in a temporary `.env`.

## Pre-cutover snapshot (do this every time)

Immediately before step 8:

```bash
./02-export.sh
tar czf ~/kutchihub-snapshot-$(date +%Y%m%d-%H%M).tar.gz migration/data
```

Store that archive outside the repo. It is a point-in-time copy of every row
and is the ultimate fallback.

## Abort criteria — stop the migration if any of these happen

- `04-verify.sql` output differs between old and new (counts or checksums).
- Any orphan-check row is non-zero.
- The admin sanity query does not return your admin account.
- `06-storage-copy.ts` reports a destination/source mismatch.
- Sign-in does not work on the Vercel Preview deployment.

## Do not do this until you are stable

- Do not delete the Lovable project.
- Do not let the Lovable plan lapse mid-migration.
- Give it at least 2 weeks of normal traffic on the new backend first.
