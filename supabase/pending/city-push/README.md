# City push notifications - phase 1 (browser)

"New business in Ahmedabad: <name> (<category>)" for people who picked that city. Phase 1 = web push; the Android app (1.0.4) joins
in phase 2 with the same tables and sender.

## Order
1. Deploy the site (the code works without any of the steps below: nothing is shown, nothing is sent).
2. Run `01_migration.sql`, then `03_verify.sql` (every row `ok = true`). `02_revert.sql` undoes it.
   (Replaces `supabase/pending/ios-push`, which was never applied: do not run both.)
3. Firebase project + keys (see the report): set the environment variables on Vercel and redeploy.
4. Scheduler (every 10 minutes) - ONE of:
   - **Vercel Hobby**: run `04_schedule_pg_cron.sql` in the Supabase SQL editor (the secret is stored in Supabase Vault).
   - **Vercel Pro**: add to `vercel.json` (do NOT add it on Hobby: the deploy would fail)
     `"crons": [{ "path": "/api/push/dispatch", "schedule": "*/10 * * * *" }]`. Vercel sends `Authorization: Bearer $CRON_SECRET` itself.
5. Turn the feature on: `SHOW_CITY_PUSH = true` in `src/lib/features.ts` (the card appears on the home page, the admin approve list gets
   "Notify users of this city"). The sender works without the flag; the flag only shows the UI.

## Environment variables
| Name | Where | Secret? |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY` | Vercel (build time) | No: public Firebase web settings |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Vercel (server only) | **YES**: the service-account key (JSON text or base64). Never in the app, the website code, git or chat |
| `CRON_SECRET` | Vercel (server only) AND Supabase Vault (Hobby) | **YES**: any long random string; the same value in both places |

Missing variables = quiet: the card is hidden (client), `/api/push/dispatch` answers 503 / "not_configured" and sends nothing.

## The rules the sender follows
- A business is announced once, when it becomes `published` (not when restored from `archived`), if its `notify_city` switch is on.
- Only if the PUBLIC can see it (asked as an anonymous visitor, so the active-plan rule is respected whether it is on or not).
- At most 3 single notifications per city per day (India time); the rest go in ONE summary from 19:00 ("5 more new businesses ...").
  So at most 4 notifications a day per city.
- Nothing between 21:00 and 08:00 India time. A waiting business that cannot be announced is dropped after 72 hours.
