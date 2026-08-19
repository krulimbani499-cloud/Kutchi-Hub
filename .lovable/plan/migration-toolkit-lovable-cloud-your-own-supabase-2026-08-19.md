# Migration Toolkit: Lovable Cloud -> Your Own Supabase

Goal: move database, auth users and storage into a Supabase project you own, so the frontend can run on Vercel with your own service role key. Nothing is changed in the live app by this plan — it only adds a `migration/` folder of scripts and instructions to the repo.

## Good news on scale

Current data is small, so the whole move is low risk:

```text
business_events 87   categories 49   user_roles 15   profiles 11
banner_ads 11        audit_logs 10   point_events 9  discount_claims 8
business_photos 6    plans 4         ad_slots 4      businesses 3
business_products 3  reviews 2       notifications 2 favorites 1
(claims, services, reports, subscriptions, enquiries, referrals, events = 0)
```

Roughly 11 auth users and 6 photos to move.

## What gets added to the repo

A new `migration/` folder:

1. `README.md` — step-by-step runbook (the master document, written so it can be followed top to bottom without guessing).
2. `01-schema.md` — how to replay the 59 existing files in `supabase/migrations/` into the new project with `supabase db push`, plus a verification query listing every table, policy, function and trigger so you can diff old vs new.
3. `02-export.sh` — exports every public table to CSV in the correct dependency order, into `migration/data/`. Order: plans, categories, ad_slots, profiles, user_roles, businesses, business_photos, business_products, business_services, business_subscriptions, business_reviews, business_enquiries, business_claims, business_favorites, business_events, banner_ads, events, notifications, point_events, referrals, discount_claims, reports, audit_logs.
4. `03-import.sh` — imports those CSVs into the new project in the same order, inside a single transaction, with `session_replication_role = replica` so triggers and FK checks do not fight the load, then re-enables them.
5. `04-verify.sql` — prints a row count per table; run it against both databases and compare side by side. Also checks orphan rows (any child row whose parent id is missing) and that every `user_id` in public tables exists in `auth.users`.
6. `05-auth-users.ts` — reads the exported user list and recreates each user in the new project **with the same UUID** via the Auth Admin API, so every foreign key keeps working. Passwords cannot be copied (Lovable Cloud does not expose the source service key), so users are created as confirmed accounts without a password and the script prints a ready-to-send password-reset list. Google/Apple identities relink on next sign-in by email.
7. `06-storage-copy.ts` — lists every object in `business-photos` on the old project, downloads via signed URL, re-uploads to the new project at the identical path, then verifies object count and that each `business_photos.url` / `businesses.catalog_url` / `featured_image` resolves.
8. `07-env.md` — the exact environment variables to set in Vercel and locally, plus the Google OAuth change needed once you leave Lovable hosting.
9. `08-rollback.md` — see below.

All scripts read connection details from a `migration/.env` file (git-ignored) with `OLD_DB_URL`, `NEW_DB_URL`, `NEW_SUPABASE_URL`, `NEW_SERVICE_ROLE_KEY`, `OLD_SUPABASE_URL`, `OLD_ANON_KEY`. Every script is idempotent: re-running it will not duplicate rows or users.

## Safety design

- Export is read-only. Nothing runs against the old project except SELECTs and signed-URL downloads.
- Import runs in one transaction per table set — a failure rolls back that batch rather than leaving half-loaded tables.
- Every script has a `--dry-run` flag that prints what it would do and touches nothing.
- The old backend stays fully live and untouched during the whole process, so the current site keeps working.

## Rollback plan

Because the old Lovable Cloud backend is never modified, rollback is simply "keep using it":

1. **Before DNS cutover** — abort by doing nothing. Delete rows in the new project (`08-rollback.md` includes a `TRUNCATE ... CASCADE` script in reverse dependency order) and re-run the import after fixing the issue.
2. **After Vercel env switch, before DNS** — revert the Vercel environment variables to the Lovable Cloud values (kept in `07-env.md`) and redeploy; the site is back on the old backend in minutes.
3. **After DNS cutover** — point DNS back, restore the old env vars, redeploy. Any data written to the new backend during the window is captured by a `09-delta-sync.sh` script that re-exports rows created after the cutover timestamp so nothing new is lost.
4. A pre-cutover snapshot: run `02-export.sh` one final time immediately before cutover and commit the CSVs to a private branch / archive, so there is always a point-in-time copy of every row.

## Cutover sequence (from the README)

```text
1. Create new Supabase project        (no downtime)
2. supabase db push                   (schema + RLS + triggers)
3. 05-auth-users.ts                   (users, same UUIDs)
4. 02-export.sh  ->  03-import.sh     (data)
5. 06-storage-copy.ts                 (files)
6. 04-verify.sql on both  -> compare  (gate: must match)
7. Deploy a Vercel PREVIEW with new env vars, test end to end
8. Switch production env vars + redeploy
9. Watch for 24-48h, then DNS/final cutover
```

Step 6 is a hard gate: do not proceed if counts differ.

## Technical notes

- Auth passwords are the only thing that genuinely cannot be transferred; the script handles this by creating confirmed users and generating reset links.
- `src/integrations/supabase/client.ts`, `auth-middleware.ts` and `client.server.ts` already read `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, so no application code changes are needed for the database swap.
- `AuthForms.tsx` will need Google sign-in switched from the Lovable broker to `supabase.auth.signInWithOAuth` with your own Google client credentials — flagged in `07-env.md`, not changed by this plan.
- Storage policies on `storage.objects` already exist in two of the migration files, so `supabase db push` reproduces them.
