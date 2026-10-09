// Read-only check using the PUBLIC anon key, exactly what a visitor can reach.
// Usage (from the repo root):   node supabase/pending/active-plan-rule/04_verify_public.mjs
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env in-process; prints no keys.
// Run it BEFORE the migration (records the baseline) and AFTER (checks the rule).
//   After the migration: businesses that still have a cached plan stay, the others vanish,
//   every banner returned belongs to a visible business, and no child rows leak.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const base = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const get = async (p) => {
  const r = await fetch(`${base}/rest/v1/${p}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`${p} -> HTTP ${r.status}`);
  return r.json();
};

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}  ${extra}`);
};

const biz = await get("businesses?select=id,name,city,slug,current_plan_id&limit=5000");
const visibleIds = new Set(biz.map((b) => b.id));
console.log(`anon sees ${biz.length} businesses`);
for (const b of biz) console.log(`  ${b.name} | ${b.city} | cached plan: ${b.current_plan_id ? "yes" : "NO"}`);

// Every visible business must carry a plan (cache is a proxy; the SQL script is authoritative).
const noPlan = biz.filter((b) => !b.current_plan_id);
ok("no visible business is missing a plan (cache proxy)", noPlan.length === 0, noPlan.map((b) => b.name).join(", "));

// Banners tied to a business must belong to a visible business.
const now = new Date().toISOString();
const banners = await get(`banner_ads?select=id,title,business_id&active=eq.true&start_at=lte.${now}&limit=500`);
const orphan = banners.filter((x) => x.business_id && !visibleIds.has(x.business_id));
ok(`banners (${banners.length}) all belong to a visible business or have none`, orphan.length === 0, orphan.map((x) => x.title).join(", "));

// Child tables must not leak rows of hidden businesses.
for (const t of ["business_photos", "business_products", "business_services", "business_reviews"]) {
  const rows = await get(`${t}?select=business_id&limit=5000`);
  const leaked = rows.filter((r) => !visibleIds.has(r.business_id));
  ok(`${t}: ${rows.length} rows, none for a hidden business`, leaked.length === 0, `leaked=${leaked.length}`);
}

// Slug lookups of any hidden business must return nothing (spot check with a made-up id).
const miss = await get("businesses?select=id&slug=eq.__definitely-not-a-business__");
ok("unknown slug returns no row", miss.length === 0);

console.log(fail ? `\n${fail} FAILED` : "\nall checks passed");
process.exit(fail ? 1 : 0);
