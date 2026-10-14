// Server-only: turns a business's Google Maps link / address into latitude + longitude.
// The Google key is passed in by the caller (never read from the environment here) and never logged or returned.
// Relative imports carry the .ts extension so scripts/backfill-coords.mjs can load this file with Node.
import { isInIndia } from "./geocode.ts";
import {
  coordsFromMapsUrl,
  isShortLinkHost,
  parseAllowedGoogleUrl,
  placeTextFromMapsUrl,
  type LatLng,
} from "./maps-url.ts";
import { RateLimiter } from "./rate-limit.ts";
import { TtlCache, haversineKm } from "./places.ts";

export type CoordsSource =
  | "url" // the link itself contains the coordinates
  | "short-link" // the redirect target contains the coordinates
  | "short-link-place" // the redirect target names the place; that text was geocoded
  | "geocode"; // the saved address / city was geocoded

export type ResolvedCoords = LatLng & { source: CoordsSource; approximate: boolean };

export type ResolveInput = {
  google_maps_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

/** The small part of fetch() the redirect follower needs, so a caller can supply its own (see the backfill script). */
export type RedirectFetch = (
  url: string,
  init: { redirect: "manual"; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; headers: { get(name: string): string | null }; body?: { cancel?: () => unknown } | null }>;

export type ResolveDeps = {
  /** Google Geocoding key. Without it only coordinates written in the link are found. */
  geocodeKey?: string;
  /** Who is asking (user id / IP) for the per-minute limit; null or undefined = not limited (scripts). */
  rateLimitKey?: string | null;
  fetchImpl?: RedirectFetch;
  /**
   * Centre of the business's city, when known. A GEOCODED point (not one written in the link) more than 20 km
   * from it is treated as a wrong match and the next method is tried (the biggest listed city, Ahmedabad,
   * has businesses up to ~13 km out; a vague address like "ahmedabad road, dahegam" can land 24 km away).
   */
  cityCentre?: LatLng | null;
};

const FAR_FROM_CITY_KM = 20;

const REDIRECT_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

// 10 lookups that need the network per minute per caller. A link that already holds coordinates is free.
const limiter = new RateLimiter(10);
// Successful answers are remembered for a day (same link + address => same coordinates).
const cache = new TtlCache<ResolvedCoords>(24 * 60 * 60_000, 500);

/** Follows up to 3 redirects, only through allowed Google hosts over https. Returns the last URL reached. */
async function followRedirects(start: string, fetchImpl: RedirectFetch, signal: AbortSignal): Promise<string> {
  let url = start;
  for (let followed = 0; ; followed++) {
    const u = parseAllowedGoogleUrl(url);
    if (!u) return url; // not an allowed host: never fetched
    const res = await fetchImpl(u.toString(), {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KutchiHub/1.0)", Accept: "text/html" },
      signal,
    });
    try {
      await res.body?.cancel?.();
    } catch {
      /* body not needed */
    }
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location || followed >= MAX_REDIRECTS) return url;
    try {
      url = new URL(location, u).toString();
    } catch {
      return url;
    }
    // Already enough to work with (coordinates, or the place's name + address): do not download the Maps page itself.
    if (coordsFromMapsUrl(url) || placeTextFromMapsUrl(url)) return url;
  }
}

type Geocoded = LatLng & { approximate: boolean };

/**
 * Google Geocoding. `locality` (optional) restricts the answer to that town, which keeps "…ahmedabad road, dahegam"
 * from landing in Ahmedabad; if Google knows no such locality it is retried without. A result that is only a whole
 * country or state (Google's answer to text it can't place) is refused.
 */
async function geocodeText(
  text: string,
  key: string,
  signal: AbortSignal,
  locality?: string,
): Promise<Geocoded | null> {
  const ask = async (components: string): Promise<Geocoded | null | "zero"> => {
    const res = await fetch(
      "https://maps.googleapis.com/maps/api/geocode/json?" +
        new URLSearchParams({ address: text, region: "in", components, key }),
      { signal },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      status: string;
      results?: Array<{ types?: string[]; geometry: { location: { lat: number; lng: number }; location_type?: string } }>;
    };
    if (body.status === "ZERO_RESULTS") return "zero";
    const top = body.status === "OK" ? body.results?.[0] : undefined;
    if (!top || !isInIndia(top.geometry.location.lat, top.geometry.location.lng)) return null;
    if (top.types?.some((t) => t === "country" || t === "administrative_area_level_1")) return null;
    return {
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      // ROOFTOP / RANGE_INTERPOLATED are street-level; GEOMETRIC_CENTER / APPROXIMATE are a street, area or town centre.
      approximate: top.geometry.location_type !== "ROOFTOP" && top.geometry.location_type !== "RANGE_INTERPOLATED",
    };
  };
  try {
    if (locality) {
      const first = await ask(`country:IN|locality:${locality}`);
      if (first !== "zero") return first;
    }
    const plain = await ask("country:IN");
    return plain === "zero" ? null : plain;
  } catch {
    // Deliberately no error details: some runtimes echo the request URL, which contains the key.
    return null;
  }
}

/**
 * 1. coordinates written in the Maps link;
 * 2. a Google short link: follow it (≤3 redirects, 5 s, Google hosts only) and read the coordinates, or the
 *    place name + address it points at, from the final URL;
 * 3. geocode "address, city, state, India".
 * Anything outside India, any failure, and the rate limit all give null (the caller saves without coordinates).
 */
export async function resolveCoords(input: ResolveInput, deps: ResolveDeps = {}): Promise<ResolvedCoords | null> {
  const url = input.google_maps_url?.trim() || "";
  const addressText = [input.address, input.city, input.state, "India"]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  const hasAddress = Boolean(input.city?.trim() || input.address?.trim());

  // 1. The link itself (free: no network, not rate limited).
  if (url) {
    const direct = coordsFromMapsUrl(url);
    if (direct) return { ...direct, source: "url", approximate: false };
  }

  const cacheKey = [url, input.address, input.city, input.state].map((v) => (v ?? "").trim().toLowerCase()).join("|");
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  if (deps.rateLimitKey && !limiter.take(deps.rateLimitKey)) return null;

  const done = (found: ResolvedCoords | null) => {
    if (found) cache.set(cacheKey, found);
    return found;
  };
  const signal = AbortSignal.timeout(REDIRECT_TIMEOUT_MS * 2);
  const plausible = (p: LatLng) =>
    !deps.cityCentre || haversineKm(p.lat, p.lng, deps.cityCentre.lat, deps.cityCentre.lng) <= FAR_FROM_CITY_KM;

  // 2. A Google link we are allowed to open.
  const allowed = url ? parseAllowedGoogleUrl(url) : null;
  if (allowed) {
    let finalUrl = url;
    if (isShortLinkHost(allowed.hostname)) {
      try {
        finalUrl = await followRedirects(url, deps.fetchImpl ?? (fetch as unknown as RedirectFetch), AbortSignal.timeout(REDIRECT_TIMEOUT_MS));
      } catch {
        finalUrl = url; // timeout / network error: fall through to the address
      }
      const viaRedirect = coordsFromMapsUrl(finalUrl);
      if (viaRedirect) return done({ ...viaRedirect, source: "short-link", approximate: false });
    }
    const placeText = placeTextFromMapsUrl(finalUrl);
    if (placeText && deps.geocodeKey) {
      const g = await geocodeText(placeText, deps.geocodeKey, signal);
      if (g && plausible(g)) return done({ lat: g.lat, lng: g.lng, source: "short-link-place", approximate: g.approximate });
    }
  }

  // 3. The business's own address (restricted to its city when Google knows it).
  if (hasAddress && deps.geocodeKey) {
    const g = await geocodeText(addressText, deps.geocodeKey, signal, input.city?.trim() || undefined);
    if (g && plausible(g)) return done({ lat: g.lat, lng: g.lng, source: "geocode", approximate: g.approximate });
  }
  return null;
}
