// Browser geolocation + matching of Google place names to our city list.
// The reverse geocoding itself runs on the server (reverseGeocodeCity in maps.functions.ts).
// Client-only: never call from a loader or server function.
import type { GeocodeCandidates } from "./geocode";

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: "gps" | "ip";
  warning?: string;
}

function formatBrowserLocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Enable it in browser settings.";
    case error.POSITION_UNAVAILABLE:
      return "GPS unavailable. Turn on location services and try again.";
    case error.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "Could not determine your location.";
  }
}

export async function getCurrentLocation(): Promise<GeolocationResult> {
  if (typeof window === "undefined") throw new Error("Location is browser only.");
  if (!navigator.geolocation) throw new Error("Geolocation is not supported by this browser.");

  // Watch for a short window and keep the most accurate fix. The first
  // fix from a phone/laptop is often a coarse cell/wifi estimate (500m+);
  // GPS refines it within a few seconds. We resolve early once we see a
  // good enough reading (<= 30m) or when the window ends.
  return new Promise((resolve, reject) => {
    let best: GeolocationPosition | null = null;
    let done = false;
    const GOOD_ENOUGH_M = 30;
    const MAX_WAIT_MS = 12000;

    const finish = (err?: GeolocationPositionError) => {
      if (done) return;
      done = true;
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* noop */
      }
      clearTimeout(timer);
      if (best) {
        resolve({
          latitude: best.coords.latitude,
          longitude: best.coords.longitude,
          accuracy: best.coords.accuracy ?? Infinity,
          source: "gps",
        });
      } else if (err) {
        reject(new Error(formatBrowserLocationError(err)));
      } else {
        reject(new Error("Could not determine your location."));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || (pos.coords.accuracy ?? Infinity) < (best.coords.accuracy ?? Infinity)) {
          best = pos;
        }
        if (best && (best.coords.accuracy ?? Infinity) <= GOOD_ENOUGH_M) {
          finish();
        }
      },
      (err) => {
        // If we already have any fix, keep it; otherwise surface the error.
        if (best) finish();
        else finish(err);
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 },
    );

    const timer = setTimeout(() => finish(), MAX_WAIT_MS);
  });
}

export const LOCATION_UNAVAILABLE = "Location not available — please select your city";

// Common spelling variants, keyed by the cleaned name (see cleanPlaceName).
const CITY_ALIASES: Record<string, string> = {
  dehgam: "Dahegam",
  himmatnagar: "Himatnagar",
  ahmadabad: "Ahmedabad",
  amdavad: "Ahmedabad",
  kapadwanj: "Kapadvanj",
  baroda: "Vadodara",
};

// Spellings that only mean one of our entries inside a given district (cleaned names).
// "Vadagam"/"Vadgam" are different villages in Aravalli and Banaskantha, so the district decides.
const DISTRICT_ALIASES: Record<string, { district: string; city: string }> = {
  vadagam: { district: "aravalli", city: "Vadagam (Aravalli)" },
  vadgam: { district: "aravalli", city: "Vadagam (Aravalli)" },
};

function cleanPlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(taluka|taluk|tehsil|tahsil|district|dist|municipal corporation|nagar palika|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Picks the first place name (they arrive most specific first: sublocality, neighbourhood, locality,
 * taluka, district) that is in our city list, so a listed village or suburb wins over the town, city
 * or taluka around it. Returns null when nothing matches.
 */
export function resolveListedCity(
  { names, district }: Pick<GeocodeCandidates, "names" | "district">,
  cities: string[],
): string | null {
  const byName = new Map(cities.map((c) => [cleanPlaceName(c), c]));
  const districtKey = district ? cleanPlaceName(district) : "";
  for (const raw of names) {
    const key = cleanPlaceName(raw);
    const scoped = DISTRICT_ALIASES[key];
    if (scoped && scoped.district === districtKey && cities.includes(scoped.city)) return scoped.city;
    const match = byName.get(key) ?? CITY_ALIASES[key];
    if (match) return match;
  }
  return null;
}