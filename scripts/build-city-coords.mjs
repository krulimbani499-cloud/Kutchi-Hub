// Builds src/data/city-coords.json: latitude/longitude of every city that has published businesses.
// The "places near you" card uses it to find the nearest cities that have businesses.
//
//   node scripts/build-city-coords.mjs
//
// Reads .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, GOOGLE_MAPS_API_KEY) and does a read-only
// select on published businesses. Cities already in the JSON are kept; use --refresh to geocode them again.
// Run it again whenever a business is published in a new city (a missing city is still geocoded on the
// server at runtime and remembered in memory, so forgetting to re-run is not an error).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "src", "data", "city-coords.json");
const refresh = process.argv.includes("--refresh");

const env = {};
for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const need = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "GOOGLE_MAPS_API_KEY"];
for (const k of need) if (!env[k]) throw new Error(`${k} is missing from .env`);

const cityKey = (city) => city.trim().toLowerCase().replace(/\s+/g, " ");
// Same query as geocodeQueryForCity in src/lib/places.ts: "Vadagam (Aravalli)" -> "Vadagam, Aravalli, Gujarat, India".
const queryFor = (city, state) =>
  [city.replace(/\(([^)]*)\)/g, ", $1").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim(), state?.trim() || "", "India"]
    .filter(Boolean)
    .join(", ");
const inIndia = (lat, lng) => lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase.from("businesses").select("city, state").eq("status", "published").limit(5000);
if (error) throw new Error(error.message);

// Group spellings ("Himatnagar" / "HIMATNAGAR") under one key; keep the most used spelling as the name.
const groups = new Map();
for (const row of data ?? []) {
  const name = row.city?.trim();
  if (!name) continue;
  const g = groups.get(cityKey(name)) ?? { spellings: new Map(), state: null };
  g.spellings.set(name, (g.spellings.get(name) ?? 0) + 1);
  g.state ??= row.state?.trim() || null;
  groups.set(cityKey(name), g);
}

const result = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
let added = 0;
for (const [key, g] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
  const name = [...g.spellings].sort((a, b) => b[1] - a[1])[0][0];
  if (result[key] && !refresh) {
    console.log(`keep    ${name}`);
    continue;
  }
  const query = queryFor(name, g.state);
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({ address: query, region: "in", components: "country:IN", key: env.GOOGLE_MAPS_API_KEY });
  const body = await (await fetch(url)).json();
  const hit = body.status === "OK" ? body.results?.[0] : null;
  const loc = hit?.geometry?.location;
  if (!loc || !inIndia(loc.lat, loc.lng)) {
    // Never print the request URL: it contains the key.
    console.log(`MISSING ${name}  (query "${query}", Google status ${body.status})`);
    continue;
  }
  result[key] = { name, lat: Number(loc.lat.toFixed(5)), lng: Number(loc.lng.toFixed(5)) };
  added += 1;
  console.log(`added   ${name}  ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}  -> ${hit.formatted_address}`);
}

const sorted = Object.fromEntries(Object.entries(result).sort((a, b) => a[0].localeCompare(b[0])));
writeFileSync(outFile, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\n${Object.keys(sorted).length} cities in src/data/city-coords.json (${added} added)`);
