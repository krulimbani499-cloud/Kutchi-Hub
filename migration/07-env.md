# Step 7/8 — Environment variables and the OAuth change

## Variables to set on Vercel

Project → Settings → Environment Variables. Set for **Production** *and*
**Preview** (test on Preview first).

| Name | Value | Exposed to browser |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR-REF.supabase.co` | yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your anon / publishable key | yes |
| `VITE_SUPABASE_PROJECT_ID` | `YOUR-REF` | yes |
| `SUPABASE_URL` | `https://YOUR-REF.supabase.co` | no (SSR) |
| `SUPABASE_PUBLISHABLE_KEY` | your anon / publishable key | no (SSR) |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key | **NO — server only** |

No application code changes are needed for the database swap:
`src/integrations/supabase/client.ts`, `auth-middleware.ts` and
`client.server.ts` already read exactly these names.

After setting them: **Redeploy without build cache** (Deployments → ⋯ →
Redeploy, uncheck "Use existing build cache"). `VITE_*` values are baked in at
build time, so a plain restart is not enough.

### Keep the old values

Paste your current Lovable Cloud values here before you change anything — this
is what you restore during a rollback:

```
VITE_SUPABASE_URL=https://c--c1f966f3-d13d-46a0-bcb5-dd6d6ce8492b-prod.lovable.cloud
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBva2J6c3N1bGloZmR3YmVscXdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzYxODUsImV4cCI6MjA5ODQ1MjE4NX0.cavWuICsB7qSYjA80QAxJLqAETRUtQpAxyTJwLGRIWE
VITE_SUPABASE_PROJECT_ID=pokbzssulihfdwbelqwk
```

## Auth settings to re-apply in your new project

Authentication → URL Configuration:

- **Site URL:** your production domain (e.g. `https://kutchihub.com`)
- **Redirect URLs:** add
  - `https://yourdomain.com/**`
  - `https://your-project.vercel.app/**`
  - `http://localhost:8080/**`

Authentication → Providers:

- **Email:** enabled, confirm email ON, no anonymous sign-ups.
- **Google / Apple:** create your own OAuth credentials and paste client
  id + secret. Authorized redirect URI is
  `https://YOUR-REF.supabase.co/auth/v1/callback`.

Also set the password-reset email template, since users will need it after
step 3.

## Code change required for Google sign-in

`src/components/auth/AuthForms.tsx` currently uses the Lovable managed OAuth
broker:

```ts
await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
```

That broker only accepts Lovable-hosted origins, which is exactly why Google
sign-in fails on Vercel today. Once you are on your own Supabase project,
replace it with the plain Supabase call:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

Do the same for Apple, and then delete `isOAuthSupportedHost()` — the host
restriction no longer applies, so the social buttons can show everywhere.

The native (Capacitor) app keeps hiding social buttons via
`isRunningInsideMobileApp()`; that logic is unrelated and stays as is.

## Other things not carried by the database migration

- **Storage bucket policies** — created by `supabase db push` (they live in two
  of the migration files).
- **Absolute asset URLs** pointing at the old host — see the reminder printed
  by `06-storage-copy.ts`.
- **`vercel.json` rewrites** — the `/~oauth/*` rewrite to the Lovable proxy can
  be removed once Google auth runs on your own Supabase project.
