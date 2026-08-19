/**
 * Step 3 — Recreate auth users in the NEW project with IDENTICAL UUIDs.
 *
 *   bun run migration/05-auth-users.ts [--dry-run]
 *   (or: npx tsx migration/05-auth-users.ts)
 *
 * Why UUIDs must match: every public table references auth.users(id) —
 * businesses.owner_id, profiles.user_id, user_roles.user_id, reviews,
 * favorites, notifications, point_events, referrals, audit_logs. Reusing the
 * same ids means all the exported data just works.
 *
 * Passwords: Lovable Cloud does not expose the source project's service key or
 * DB password, so password hashes cannot be copied. Users are created as
 * email-confirmed accounts with a random unusable password, and this script
 * prints a password-reset list at the end. Google/Apple users simply sign in
 * again with the same email and relink to the same id.
 *
 * Idempotent: existing users are skipped, never duplicated.
 *
 * Input: migration/data/auth_users.csv  (written by 02-export.sh)
 *        columns: id,email,phone,created_at,email_confirmed_at,raw_user_meta_data
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

loadEnvFile(resolve(HERE, ".env"));

const NEW_SUPABASE_URL = requireEnv("NEW_SUPABASE_URL");
const NEW_SERVICE_ROLE_KEY = requireEnv("NEW_SERVICE_ROLE_KEY");

const admin = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = {
  id: string;
  email: string;
  phone: string;
  created_at: string;
  email_confirmed_at: string;
  raw_user_meta_data: string;
};

async function main() {
  const csvPath = resolve(HERE, "data/auth_users.csv");
  if (!existsSync(csvPath)) {
    console.error(`Missing ${csvPath}. Run 02-export.sh first (or create the CSV
manually with columns: id,email,phone,created_at,email_confirmed_at,raw_user_meta_data).`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8")) as unknown as Row[];
  console.log(`Found ${rows.length} users to migrate.\n`);

  // Existing users in the destination, so re-runs are safe.
  const existing = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    data.users.forEach((u) => existing.add(u.id));
    if (data.users.length < 200) break;
  }

  const created: Array<{ id: string; email: string }> = [];
  const skipped: string[] = [];
  const failed: Array<{ email: string; reason: string }> = [];

  for (const row of rows) {
    if (!row.id) continue;
    if (existing.has(row.id)) {
      skipped.push(row.email || row.id);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] create ${row.email || "(no email)"}  id=${row.id}`);
      created.push({ id: row.id, email: row.email });
      continue;
    }

    let meta: Record<string, unknown> = {};
    try {
      meta = row.raw_user_meta_data ? JSON.parse(row.raw_user_meta_data) : {};
    } catch {
      meta = {};
    }

    const { error } = await admin.auth.admin.createUser({
      id: row.id,
      email: row.email || undefined,
      phone: row.phone || undefined,
      email_confirm: Boolean(row.email_confirmed_at),
      password: randomBytes(24).toString("base64url"), // unusable; user resets
      user_metadata: meta,
    });

    if (error) {
      failed.push({ email: row.email || row.id, reason: error.message });
      console.log(`  FAIL  ${row.email}: ${error.message}`);
    } else {
      created.push({ id: row.id, email: row.email });
      console.log(`  ok    ${row.email}  id=${row.id}`);
    }
  }

  console.log(
    `\ncreated=${created.length}  skipped(existing)=${skipped.length}  failed=${failed.length}`,
  );

  if (!DRY_RUN && created.length) {
    const list = created.filter((u) => u.email).map((u) => u.email);
    writeFileSync(resolve(HERE, "data/password-reset-list.txt"), list.join("\n") + "\n");
    console.log(`\nWrote data/password-reset-list.txt (${list.length} emails).`);
    console.log(`Ask these users to use "Forgot password" once, or generate links:

  for e in $(cat migration/data/password-reset-list.txt); do echo "$e"; done

Google/Apple users need no action — they sign in again with the same email.`);
  }

  if (failed.length) {
    console.log("\nFailures — resolve before continuing to step 4:");
    failed.forEach((f) => console.log(`  ${f.email}: ${f.reason}`));
    process.exit(1);
  }

  console.log(`
NOTE: your migrations include a trigger on auth.users that auto-creates a
profiles row and a user_roles('user') row for each new user, plus an admin
grant for the designated admin email. That is expected — 03-import.sh uses
ON CONFLICT DO NOTHING, so the exported profile/role rows merge cleanly.
Confirm with the admin sanity check at the end of 04-verify.sql.`);
}

// --- helpers -------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. Fill in migration/.env (see .env.example).`);
    process.exit(1);
  }
  return v;
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** Minimal RFC4180 CSV parser (handles quotes, embedded commas and newlines). */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
