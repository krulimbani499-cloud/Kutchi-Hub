import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { RateLimiter } from "./rate-limit";
import { createServerSupabaseClient } from "./businesses.server";
import { isInIndia } from "./geocode";
import { canonicalCityName } from "./geolocation";
import {
  PLACE_TYPES,
  MAX_SUGGESTIONS,
  TtlCache,
  cityKey,
  geocodeQueryForCity,
  haversineKm,
  parseAutocomplete,
  parseDetails,
  parseGeocodeDetails,
  type PlaceDetails,
  type PlaceSuggestion,
} from "./places";
import cityCoordsJson from "@/data/city-coords.json";

// Everything here runs on the server: GOOGLE_MAPS_API_KEY never reaches the browser, and Google errors
// are swallowed (the caller then shows only the local city list) so the key or its URL can't leak.

const CACHE_MS = 10 * 60_000;
const suggestionCache = new TtlCache<PlaceSuggestion[]>(CACHE_MS, 500);
const detailsCache = new TtlCache<PlaceDetails>(CACHE_MS, 500);
const businessCitiesCache = new TtlCache<BusinessCity[]>(60_000, 1);
const geocodeCache = new TtlCache<{ lat: number; lng: number } | null>(24 * 60 * 60_000, 500);

const sessionToken = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

// Per IP and per minute. Only requests that would reach Google are counted (answers from memory are free).
// Over the limit a function returns an empty result, so the UI quietly falls back to the local city list.
const autocompleteLimiter = new RateLimiter(30);
const detailsLimiter = new RateLimiter(10);
const geocodeLimiter = new RateLimiter(10);

function clientIp(): string {
  try {
    const headers = getRequest().headers;
    return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

/** Town / village search while typing a city. Identical queries are answered from memory for ~10 minutes. */
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        // Longer text is cut to 60 characters instead of being rejected.
        query: z.string().transform((s) => s.trim().slice(0, 60)).pipe(z.string().min(2)),
        sessionToken,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; places: PlaceSuggestion[] }> => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return { ok: false, places: [] };
    const cacheKey = cityKey(data.query);
    const cached = suggestionCache.get(cacheKey);
    if (cached) return { ok: true, places: cached };
    if (!autocompleteLimiter.take(clientIp())) return { ok: false, places: [] };
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: data.query,
          includedRegionCodes: ["in"],
          includedPrimaryTypes: PLACE_TYPES,
          languageCode: "en",
          regionCode: "IN",
          sessionToken: data.sessionToken,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return { ok: false, places: [] };
      const places = parseAutocomplete(await res.json()).slice(0, MAX_SUGGESTIONS);
      suggestionCache.set(cacheKey, places);
      return { ok: true, places };
    } catch {
      return { ok: false, places: [] };
    }
  });

/** Where a picked suggestion is (lat/lng) and which district it is in. Ends the autocomplete session. */
export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/), sessionToken }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; details: PlaceDetails | null }> => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return { ok: false, details: null };
    const cached = detailsCache.get(data.placeId);
    if (cached) return { ok: true, details: cached };
    if (!detailsLimiter.take(clientIp())) return { ok: false, details: null };
    try {
      const url = `https://places.googleapis.com/v1/places/${data.placeId}?sessionToken=${encodeURIComponent(data.sessionToken)}`;
      const res = await fetch(url, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location,addressComponents" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return { ok: false, details: null };
      const details = parseDetails(await res.json());
      if (!details || !isInIndia(details.lat, details.lng)) return { ok: false, details: null };
      detailsCache.set(data.placeId, details);
      return { ok: true, details };
    } catch {
      return { ok: false, details: null };
    }
  });

/**
 * Where an entry of the typed city list ("Bopal", "Naroda") is and which city it is in: one Geocoding lookup by name (and state),
 * remembered for a day. Only used when nothing has businesses under that name, to find the parent city (see resolvePick).
 */
const localityCache = new TtlCache<PlaceDetails | null>(24 * 60 * 60_000, 500);
export const resolveLocality = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ name: z.string().trim().min(2).max(80), state: z.string().trim().max(60).nullable().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; details: PlaceDetails | null }> => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return { ok: false, details: null };
    const cacheKey = `${cityKey(data.name)}|${cityKey(data.state ?? "")}`;
    const cached = localityCache.get(cacheKey);
    if (cached !== undefined) return { ok: !!cached, details: cached };
    if (!geocodeLimiter.take(clientIp())) return { ok: false, details: null };
    try {
      const url =
        "https://maps.googleapis.com/maps/api/geocode/json?" +
        new URLSearchParams({ address: geocodeQueryForCity(data.name, data.state), region: "in", components: "country:IN", key });
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return { ok: false, details: null };
      const details = parseGeocodeDetails(await res.json());
      const found = details && isInIndia(details.lat, details.lng) ? details : null;
      localityCache.set(cacheKey, found);
      return { ok: !!found, details: found };
    } catch {
      return { ok: false, details: null };
    }
  });

// ---------- Cities that have published businesses ----------

type BusinessCity = { key: string; name: string; state: string | null; count: number };

/** Published businesses grouped by city (case-insensitive, so "HIMATNAGAR" and "Himatnagar" are one entry). */
async function loadBusinessCities(): Promise<BusinessCity[]> {
  const cached = businessCitiesCache.get("all");
  if (cached) return cached;
  const supabase = createServerSupabaseClient();
  const PAGE = 1000;
  const groups = new Map<string, { spellings: Map<string, number>; state: string | null; count: number }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("businesses")
      .select("city, state")
      .eq("status", "published")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const name = row.city?.trim();
      if (!name) continue;
      const key = cityKey(name);
      const g = groups.get(key) ?? { spellings: new Map(), state: null, count: 0 };
      g.spellings.set(name, (g.spellings.get(name) ?? 0) + 1);
      g.state ??= row.state?.trim() || null;
      g.count += 1;
      groups.set(key, g);
    }
    if ((data ?? []).length < PAGE) break;
  }
  const out = [...groups].map(([key, g]) => ({
    key,
    // The most used spelling is what a tap selects.
    name: [...g.spellings].sort((a, b) => b[1] - a[1])[0][0],
    state: g.state,
    count: g.count,
  }));
  businessCitiesCache.set("all", out);
  return out;
}

/** For the city picker: which cities have businesses (those are listed first). */
export const getBusinessCities = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return (await loadBusinessCities()).map(({ name, count }) => ({ city: name, count }));
  } catch {
    return [];
  }
});

// ---------- City coordinates ----------

type Coords = { lat: number; lng: number };
const prebuilt = cityCoordsJson as Record<string, { name: string; lat: number; lng: number }>;

/** Coordinates of a city: the prebuilt file first, else geocoded on the server and remembered in memory. */
async function coordsFor(
  city: string,
  state: string | null,
  geocodeBudget: { left: number; ip: string },
): Promise<Coords | null> {
  const key = cityKey(city);
  const known = prebuilt[key];
  if (known) return { lat: known.lat, lng: known.lng };
  if (geocodeCache.get(key) !== undefined) return geocodeCache.get(key) ?? null;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || geocodeBudget.left <= 0) return null;
  // Over the per-IP limit: this city simply gets no coordinates (the card then lists fewer or no cities).
  if (!geocodeLimiter.take(geocodeBudget.ip)) return null;
  geocodeBudget.left -= 1;
  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?" +
      new URLSearchParams({ address: geocodeQueryForCity(city, state), region: "in", components: "country:IN", key: apiKey });
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const body = (await res.json()) as { status: string; results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    const loc = body.status === "OK" ? body.results?.[0]?.geometry.location : undefined;
    const found = loc && isInIndia(loc.lat, loc.lng) ? { lat: loc.lat, lng: loc.lng } : null;
    geocodeCache.set(key, found);
    return found;
  } catch {
    return null;
  }
}

/**
 * Is there any published business in this city, and if not, which cities WITH businesses are nearest.
 * The city is matched exactly (case-insensitive, spelling aliases applied), the same as the home and search pages.
 * `lat`/`lng` is where the person picked / is (autocomplete details or the device); without it the city is looked up.
 */
export const getCityCoverage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        city: z.string().trim().min(1).max(80),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const empty = { count: 0, nearest: [] as Array<{ city: string; distanceKm: number; count: number }> };
    let cities: BusinessCity[];
    try {
      cities = await loadBusinessCities();
    } catch {
      // Can't tell: report "has businesses" so no misleading card is shown.
      return { ...empty, count: -1 };
    }
    const k = cityKey(canonicalCityName(data.city));
    const count = cities.find((c) => c.key === k)?.count ?? 0;
    if (count > 0) return { ...empty, count };

    const budget = { left: 10, ip: clientIp() };
    const origin =
      data.lat !== undefined && data.lng !== undefined && isInIndia(data.lat, data.lng)
        ? { lat: data.lat, lng: data.lng }
        : await coordsFor(data.city, null, budget);
    if (!origin) return empty;

    const others = cities.filter((c) => c.key !== k);
    const located = await Promise.all(
      others.map(async (c) => ({ c, at: await coordsFor(c.name, c.state, budget) })),
    );
    const nearest = located
      .filter((x): x is { c: BusinessCity; at: Coords } => x.at !== null)
      .map(({ c, at }) => ({ city: c.name, count: c.count, distanceKm: Math.round(haversineKm(origin.lat, origin.lng, at.lat, at.lng)) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
    return { count: 0, nearest };
  });
