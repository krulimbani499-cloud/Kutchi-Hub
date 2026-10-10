// Google Geocoding helpers. Pure functions (no env, no framework) so they can be tested on their own.
// The API key is passed in by the server function and is never logged or returned.

export type GeocodeCandidates = {
  /** Place names, most specific first (sublocality, neighbourhood, locality, taluka, district). */
  names: string[];
  /** District, used to tell apart villages that share a name (e.g. Vadagam in Aravalli vs Vadgam in Banaskantha). */
  district: string | null;
  /** Name to use when nothing in our city list matches. */
  fallback: string | null;
};

type GoogleComponent = { long_name: string; types: string[] };
export type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{ address_components?: GoogleComponent[] }>;
};

// In India Google puts the taluka at administrative_area_level_4 and the district at level_3
// (level_2 is not returned), so both are listed; level_2 is kept for other regions.
const NAME_TYPES = [
  "sublocality_level_3",
  "sublocality_level_2",
  "sublocality_level_1",
  "sublocality",
  "neighborhood",
  "locality",
  "administrative_area_level_4",
  "administrative_area_level_3",
  "administrative_area_level_2",
] as const;

const EMPTY: GeocodeCandidates = { names: [], district: null, fallback: null };

function component(result: { address_components?: GoogleComponent[] }, type: string): string | undefined {
  return result.address_components?.find((c) => c.types.includes(type))?.long_name;
}

export function extractGoogleCandidates(body: GoogleGeocodeResponse): GeocodeCandidates {
  const results = body.results ?? [];
  // Only one result is used: the later ones are other nearby places (e.g. a far city shows up for Prantij).
  const best = results.find((r) => component(r, "locality")) ?? results[0];
  if (!best) return EMPTY;

  const names: string[] = [];
  for (const type of NAME_TYPES) {
    const name = component(best, type);
    if (name && !names.includes(name)) names.push(name);
  }
  return {
    names,
    district: component(best, "administrative_area_level_3") ?? component(best, "administrative_area_level_2") ?? null,
    fallback: component(best, "locality") ?? component(best, "administrative_area_level_4") ?? null,
  };
}

// Rough bounding box of India. Keeps the server function from being used as a general geocoder.
export function isInIndia(lat: number, lng: number): boolean {
  return lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
}

export async function fetchGoogleCandidates(
  lat: number,
  lng: number,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeCandidates> {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({ latlng: `${lat},${lng}`, language: "en", region: "in", key }).toString();
  let body: GoogleGeocodeResponse;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = (await res.json()) as GoogleGeocodeResponse;
  } catch (err) {
    // Deliberately not including the error object: some runtimes echo the request URL, which contains the key.
    throw new Error(`Geocoding request failed${err instanceof Error && err.message.startsWith("HTTP") ? ` (${err.message})` : ""}`);
  }
  if (body.status === "ZERO_RESULTS") return EMPTY;
  if (body.status !== "OK") throw new Error(`Geocoding failed (${body.status})`);
  return extractGoogleCandidates(body);
}
