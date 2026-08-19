# Lovable Cloud / Backend Access Guide

## Current state
- This project already has **Lovable Cloud** enabled.
- The backend (database, auth, storage) is managed by Lovable — there is no separate Supabase dashboard login and the `SUPABASE_SERVICE_ROLE_KEY` is not exposed.

## Where to find the cloud option
1. In the Lovable editor, look for the **"View Backend"** button (also labelled **Cloud** or **Backend** in the top/right toolbar).
2. Clicking it opens the managed backend panel where you can:
   - Browse database tables and rows.
   - View and edit RLS policies, triggers, and functions.
   - Run SQL queries (read-only or migration-based).
   - Export data via **Advanced settings → Export data**.
   - Manage auth users and storage buckets.

## What you can do from here
- **View / query data**: Use the backend panel's table browser or SQL runner.
- **Export data**: Cloud → Advanced settings → Export data (CSV export for tables).
- **Schema changes**: Any `CREATE TABLE`, `ALTER TABLE`, policy, trigger, or function change must go through a **migration** (Lovable handles approval and execution).
- **Auth users**: Managed in the backend panel; password resets and role assignments can be done there.
- **Storage files**: Business photos and catalogs live in the `business-photos` bucket; view/download/re-upload from the storage section.

## Important limits
- No direct Supabase dashboard URL or service-role key is available.
- For admin-level tasks that would normally need a service role, we can build a server function (`createServerFn`) that runs with privileged access inside Lovable's managed environment.

## Next step
Tell me which backend task you want to perform first (view tables, export CSVs, add a new table, manage users, etc.) and I will guide you through it or build the required migration/server function.
