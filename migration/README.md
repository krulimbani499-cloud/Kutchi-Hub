# Kutchi Hub — Backend Migration Runbook

Move the backend (database, auth users, storage) from the managed Lovable Cloud
backend to a Supabase project **you own**, so the frontend can be hosted on
Vercel with your own `SUPABASE_SERVICE_ROLE_KEY`.

Nothing in this folder modifies the application. The old backend is only ever
read from — it stays live the whole time, so you can abort at any point.

## Scale of this migration

| Table | Rows |
|---|---|
| business_events | 87 |
| categories | 49 |
| user_roles | 15 |
| profiles | 11 |
| banner_ads | 11 |
| audit_logs | 10 |
| point_events | 9 |
| discount_claims | 8 |
| business_photos | 6 |
| plans / ad_slots | 4 / 4 |
| businesses / business_products | 3 / 3 |
| business_reviews / notifications | 2 / 2 |
| business_favorites | 1 |
| everything else | 0 |

~11 auth users, ~6 storage objects. This is a small, low-risk move.

## One-time setup

1. Create your Supabase project at https://supabase.com (region: Mumbai / closest to users).
2. Copy `migration/.env.example` to `migration/.env` and fill it in.
   `migration/.env` is git-ignored — never commit it.
3. Install tooling:
   ```bash
   npm i -g supabase
   npm i            # repo deps (used by the .ts scripts via tsx/bun)
   ```

### Getting `OLD_DB_URL`

Lovable Cloud does not hand out the database password, so you cannot get a
direct Postgres URL for the old project. Two supported ways to read the old
data:

- **Preferred:** Lovable → Cloud → Advanced settings → **Export data** (CSV per
  table). Drop the CSVs into `migration/data/` using the exact filenames listed
  in `02-export.sh` and skip straight to `03-import.sh`.
- If you *do* have a direct connection string (e.g. you already run psql
  against it), set `OLD_DB_URL` and `02-export.sh` will produce those CSVs for
  you automatically.

Everything downstream of `migration/data/` works identically either way.

## Cutover sequence

```text
1. Create new Supabase project              (no downtime)
2. supabase db push                          -> 01-schema.md
3. Recreate auth users with same UUIDs       -> 05-auth-users.ts
4. Export -> import table data               -> 02-export.sh, 03-import.sh
5. Copy storage objects                      -> 06-storage-copy.ts
6. Verify counts on BOTH databases           -> 04-verify.sql   [HARD GATE]
7. Vercel PREVIEW deploy with new env vars   -> 07-env.md
8. Switch production env vars + redeploy
9. Watch 24-48h, then final DNS cutover
```

**Step 6 is a hard gate. If any count differs, stop and fix before step 7.**

Order matters: users are created *before* table data, because almost every
public table has a foreign key to `auth.users`.

## Files

| File | Purpose |
|---|---|
| `01-schema.md` | Replay the 59 SQL migrations into the new project + verify |
| `02-export.sh` | Export all public tables to CSV in dependency order |
| `03-import.sh` | Load those CSVs into the new project, safely |
| `04-verify.sql` | Row counts + orphan-row + auth-FK checks |
| `05-auth-users.ts` | Recreate auth users with identical UUIDs |
| `06-storage-copy.ts` | Copy the `business-photos` bucket across |
| `07-env.md` | Env vars for Vercel + the Google OAuth change |
| `08-rollback.md` | How to undo, at every stage |
| `09-delta-sync.sh` | Catch rows written after cutover |

Every script supports `--dry-run`.

## Golden rules

- Never run anything that writes to the old project.
- Run `02-export.sh` one last time right before cutover and archive the CSVs.
- Do not delete the Lovable project until you have run 2 weeks on the new one.
