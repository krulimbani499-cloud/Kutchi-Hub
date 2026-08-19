import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(HERE, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const admin = createClient(process.env.NEW_SUPABASE_URL!, process.env.NEW_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const EMAIL = "krutarthlimbani499@gmail.com";
const NEW_PASSWORD = process.argv[2];

if (!NEW_PASSWORD) {
  console.error("Usage: npx tsx migration/set-admin-password.ts <new-password>");
  process.exit(1);
}

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const user = list.users.find((u) => u.email === EMAIL);
if (!user) { console.error("User not found:", EMAIL); process.exit(1); }

const { error } = await admin.auth.admin.updateUserById(user.id, { password: NEW_PASSWORD });
if (error) { console.error("Failed:", error.message); process.exit(1); }
console.log(`Password set for ${EMAIL} (id=${user.id})`);
