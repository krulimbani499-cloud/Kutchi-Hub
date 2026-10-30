// Pure helpers for Google Places (New) — no env, no framework, so they can be tested on their own.
// The API key is passed in by the server function and is never logged or returned.

export type PlaceSuggestion = {
  placeId: string;
  /** Main name, e.g. "Vadagam". This is what gets stored as the city. */
  name: string;
  /** Where it is, e.g. "Mahisagar, Gujarat, India". Only used to tell same-named places apart. */
  secondary: string;
};

export type PlaceDetails = {
  lat: number;
  lng: number;
  /** District (administrative_area_level_3 in India), used for the "Vadagam (Aravalli)" rule. */
  district: string | null;
  state: string | null;
  /**
   * The `locality` component: the town or city the place is in ("Ahmedabad" for Naroda, Bopal, Kathwada ...). A locality inside a
   * city is a sublocality, so this is its parent city (see resolvePick in area.ts).
   */
  locality: string | null;
};

type AutocompleteBody = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      types?: string[];
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }>;
};

// Towns and villages only (no roads, shops or hospitals). Google accepts up to 5 primary types.
export const PLACE_TYPES = ["locality", "sublocality", "administrative_area_level_3", "administrative_area_level_4"];
const PLACE_TYPE_SET = new Set([...PLACE_TYPES, "neighborhood", "sublocality_level_1", "sublocality_level_2"]);

export const MAX_SUGGESTIONS = 8;

export function parseAutocomplete(body: AutocompleteBody): PlaceSuggestion[] {
  const out: PlaceSuggestion[] = [];
  for (const s of body.suggestions ?? []) {
    const p = s.placePrediction;
    const name = p?.structuredFormat?.mainText?.text?.trim();
    if (!p?.placeId || !name) continue;
    // Belt and braces: even with includedPrimaryTypes, drop anything that is not a place-level result.
    if (p.types && !p.types.some((t) => PLACE_TYPE_SET.has(t))) continue;
    out.push({ placeId: p.placeId, name, secondary: p.structuredFormat?.secondaryText?.text?.trim() ?? "" });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

type DetailsBody = {
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
};

export function parseDetails(body: DetailsBody): PlaceDetails | null {
  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const comp = (type: string) => body.addressComponents?.find((c) => c.types?.includes(type))?.longText ?? null;
  return {
    lat,
    lng,
    district: comp("administrative_area_level_3") ?? comp("administrative_area_level_2"),
    state: comp("administrative_area_level_1"),
    locality: comp("locality"),
  };
}

type GeocodeBody = {
  status?: string;
  results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } }; address_components?: Array<{ long_name?: string; types?: string[] }> }>;
};

/** The same details from a Geocoding API answer (used for an entry of the typed city list, which has no Places answer yet). */
export function parseGeocodeDetails(body: GeocodeBody): PlaceDetails | null {
  if (body.status !== "OK") return null;
  const r = body.results?.[0];
  const lat = r?.geometry?.location?.lat;
  const lng = r?.geometry?.location?.lng;
  if (!r || typeof lat !== "number" || typeof lng !== "number") return null;
  const comp = (type: string) => r.address_components?.find((c) => c.types?.includes(type))?.long_name ?? null;
  return {
    lat,
    lng,
    district: comp("administrative_area_level_3") ?? comp("administrative_area_level_2"),
    state: comp("administrative_area_level_1"),
    locality: comp("locality"),
  };
}

/** Great-circle distance in km. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Lower-cased, trimmed key used to group spellings like "Himatnagar" / "HIMATNAGAR". */
export const cityKey = (city: string) => city.trim().toLowerCase().replace(/\s+/g, " ");

/** Small in-memory cache with an expiry and a size cap (oldest entry goes first). Per server instance. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private ttlMs: number;
  private maxEntries: number;
  constructor(ttlMs: number, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }
  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: T) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

/** "Vadagam (Aravalli)" + "Gujarat" -> "Vadagam, Aravalli, Gujarat, India": a query Google geocodes reliably. */
export function geocodeQueryForCity(city: string, state?: string | null): string {
  const base = city.replace(/\(([^)]*)\)/g, ", $1").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  return [base, state?.trim() || "", "India"].filter(Boolean).join(", ");
}
