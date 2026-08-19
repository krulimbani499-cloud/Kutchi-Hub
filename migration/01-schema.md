# Step 2 — Recreate the schema in your new project

The full schema history already lives in `supabase/migrations/` (59 files):
tables, GRANTs, RLS policies, 28 functions, all triggers, and the
`storage.objects` policies for the `business-photos` bucket.

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-NEW-REF
supabase db push            # replays every migration in timestamp order
```

If `db push` complains that the remote already has migration history, reset
first (the new project is empty, so this is safe):

```bash
supabase db reset --linked
```

## Verify the schema landed

Run this against BOTH databases and compare the output line by line:

```sql
-- tables + row-level-security state
select tablename, rowsecurity
from pg_tables where schemaname = 'public' order by tablename;

-- policy count per table
select tablename, count(*) as policies
from pg_policies where schemaname = 'public'
group by tablename order by tablename;

-- functions
select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by proname;

-- triggers
select c.relname as table_name, t.tgname
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth')
order by 1, 2;

-- enum
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid where t.typname = 'app_role';
```

Expected on a correct new project: 23 public tables, all with `rowsecurity = t`,
28 public functions, and the `app_role` enum with `user`, `business_owner`,
`admin`.

## The auth trigger caveat

`supabase/migrations` contains triggers on `auth.users`
(`on_auth_user_created`, `on_auth_user_created_grant_designated_admin`,
`on_auth_user_confirmed_grant_designated_admin`). On your own project you have
full rights, so they will be created. Keep that in mind for step 3: creating a
user will auto-insert a `profiles` row and a `user_roles` row. `05-auth-users.ts`
and `03-import.sh` both handle this with upserts, so no duplicates result.
