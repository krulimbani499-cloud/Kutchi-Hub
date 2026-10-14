// Works out latitude / longitude for businesses that have none and WRITES SQL files for you to review and run.
// It never writes to the database: the only database access is a read-only select.
//
//   node scripts/backfill-coords.mjs
//
// Output (supabase/pending/backfill-coords/):
//   01_update.sql   one UPDATE per resolved business (… AND latitude IS NULL, so it can never overwrite a value)
//   02_revert.sql   sets the same businesses back to NULL
//   unresolved.txt  businesses that could not be resolved, or whose result looks wrong, and why
//
// Reads .env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, GOOGLE_MAPS_API_KEY (never printed).
// The public (anon) client only sees PUBLISHED businesses (pending ones are hidden by row-level security).
// To include pending ones, run with a service-role key in the shell environment (it is only used for the select):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-coords.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "supabase", "pending", "backfill-coords");

const env = {};
for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
}
for (const k of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "GOOGLE_MAPS_API_KEY"]) {
  if (!env[k]) throw new Error(`${k} is missing from .env`);
}

// The same resolver the server uses when a business is saved.
const { resolveCoords } = await import(pathToFileURL(join(root, "src", "lib", "coords.server.ts")).href);
const { haversineKm, cityKey } = await import(pathToFileURL(join(root, "src", "lib", "places.ts")).href);

// Some networks (certain Indian ISPs) answer maps.app.goo.gl / goo.gl with a wrong address, so those two hosts
// are looked up through Google's DNS-over-HTTPS and connected to directly. Other hosts use the normal fetch.
const dohHosts = new Set(["maps.app.goo.gl", "goo.gl"]);
const dohCache = new Map();
async function dohAddress(host) {
  if (!dohCache.has(host)) {
    const body = await (await fetch(`https://dns.google/resolve?name=${host}&type=A`)).json();
    const ip = body.Answer?.find((a) => a.type === 1)?.data;
    if (!ip) throw new Error(`DoH lookup failed for ${host}`);
    dohCache.set(host, ip);
  }
  return dohCache.get(host);
}
function getVia(url, ip, headers, signal) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { host: ip, servername: u.hostname, path: u.pathname + u.search, method: "GET", headers: { ...headers, Host: u.hostname }, signal },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0, headers: { get: (n) => res.headers[n.toLowerCase()] ?? null } });
      },
    );
    req.on("error", reject);
    req.end();
  });
}
const fetchImpl = async (url, init) => {
  const host = new URL(url).hostname;
  if (dohHosts.has(host)) return getVia(url, await dohAddress(host), init.headers, init.signal);
  return fetch(url, init);
};

// ---------- read-only select ----------
const readKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, readKey, { auth: { persistSession: false } });
const { data: rows, error } = await supabase
  .from("businesses")
  .select("id, name, city, state, address, google_maps_url, status, latitude, longitude")
  .in("status", ["published", "pending"])
  .or("latitude.is.null,longitude.is.null")
  .order("city")
  .order("name")
  .limit(5000);
if (error) throw new Error(error.message);
const usingServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log(`${rows.length} businesses without coordinates (${usingServiceKey ? "published + pending" : "published only: pending rows are hidden from the public client"})\n`);

const prebuilt = existsSync(join(root, "src", "data", "city-coords.json"))
  ? JSON.parse(readFileSync(join(root, "src", "data", "city-coords.json"), "utf8"))
  : {};
const FAR_KM = 40; // a pin this far from the business's own city centre is probably the wrong place

const ok = [];
const unresolved = [];
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
for (const b of rows) {
  const label = `${b.name} (${b.city})`;
  let found = null;
  try {
    found = await resolveCoords(
      { google_maps_url: b.google_maps_url, address: b.address, city: b.city, state: b.state },
      { geocodeKey: env.GOOGLE_MAPS_API_KEY, fetchImpl, cityCentre: prebuilt[cityKey(b.city ?? "")] ?? null },
    );
  } catch (e) {
    unresolved.push({ b, why: `error: ${e instanceof Error ? e.message : "unknown"}` });
    console.log(`FAIL  ${label}`);
    continue;
  }
  if (!found) {
    unresolved.push({ b, why: b.google_maps_url ? "link gave no coordinates and the address could not be geocoded" : "no Google Maps link and the address could not be geocoded" });
    console.log(`NONE  ${label}`);
    continue;
  }
  const centre = prebuilt[cityKey(b.city ?? "")];
  const away = centre ? Math.round(haversineKm(found.lat, found.lng, centre.lat, centre.lng)) : null;
  if (away !== null && away > FAR_KM) {
    unresolved.push({ b, why: `result is ${away} km from ${b.city} (${found.lat.toFixed(5)}, ${found.lng.toFixed(5)}, source ${found.source}) — check the map link / address`, found });
    console.log(`FAR   ${label}  ${away} km from the city`);
    continue;
  }
  ok.push({ b, found, away });
  console.log(`OK    ${label}  ${found.lat.toFixed(5)}, ${found.lng.toFixed(5)}  [${found.source}${found.approximate ? ", approximate" : ""}]${away !== null ? `  ${away} km from city centre` : ""}`);
}

// ---------- files (nothing is executed) ----------
mkdirSync(outDir, { recursive: true });
const q = (s) => String(s).replace(/'/g, "''");
const num = (n) => Number(n).toFixed(6);
const stamp = new Date().toISOString().slice(0, 10);

let up = `-- Backfill of businesses.latitude / longitude (generated ${stamp} by scripts/backfill-coords.mjs). NOT YET RUN.\n`;
up += `-- ${ok.length} businesses. Each UPDATE only touches a row whose latitude is still NULL, so it never overwrites a value.\n`;
up += `-- Source: url = coordinates in the saved Maps link | short-link = in the link it redirects to |\n`;
up += `--         short-link-place = the place name + address the short link points at, geocoded | geocode = saved address + city, geocoded.\n`;
up += `-- "approximate" = Google found only the street / area, not the exact building.\n`;
up += `-- Run in the Supabase SQL editor (no auth.uid(), so the admin-column guard trigger does not apply). Revert: 02_revert.sql.\n\nBEGIN;\n\n`;
for (const { b, found, away } of ok) {
  up += `-- ${one(b.name)} (${one(b.city)}) — source: ${found.source}${found.approximate ? ", approximate" : ""}${away !== null ? `, ${away} km from city centre` : ""}\n`;
  up += `UPDATE public.businesses SET latitude = ${num(found.lat)}, longitude = ${num(found.lng)} WHERE id = '${q(b.id)}' AND latitude IS NULL;\n\n`;
}
up += `COMMIT;\n`;

let down = `-- Reverts 01_update.sql: sets latitude / longitude back to NULL for exactly the businesses it filled in.\n-- (Rows that already had coordinates before are not in this list.)\n\nBEGIN;\n\n`;
if (ok.length) {
  down += `UPDATE public.businesses SET latitude = NULL, longitude = NULL WHERE id IN (\n${ok.map(({ b }) => `  '${q(b.id)}' -- ${one(b.name)} (${one(b.city)})`).join(",\n")}\n);\n\n`;
}
down += `COMMIT;\n`;

let un = `Businesses without coordinates after the backfill (${unresolved.length}) — generated ${stamp}\n`;
un += `These are NOT in 01_update.sql. Fix the Google Maps link or address (a normal save re-resolves it), or add the row by hand.\n\n`;
for (const { b, why } of unresolved) {
  un += `- ${one(b.name)} (${one(b.city)}) [${b.status}] id=${b.id}\n    link: ${one(b.google_maps_url) || "(none)"}\n    address: ${one(b.address) || "(none)"}\n    why: ${why}\n`;
}
if (!unresolved.length) un += "(none)\n";

writeFileSync(join(outDir, "01_update.sql"), up);
writeFileSync(join(outDir, "02_revert.sql"), down);
writeFileSync(join(outDir, "unresolved.txt"), un);
const bySource = ok.reduce((a, { found }) => ((a[found.source] = (a[found.source] ?? 0) + 1), a), {});
console.log(`\nresolved ${ok.length} (${Object.entries(bySource).map(([k, v]) => `${k}: ${v}`).join(", ") || "-"}), not resolved ${unresolved.length}`);
console.log(`files written to ${outDir}`);
