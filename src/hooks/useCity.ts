import { useEffect, useState, useCallback } from "react";
import { getCurrentLocation, resolveDetectedCity } from "@/lib/geolocation";
import { reverseGeocodeCity } from "@/lib/maps.functions";
import { INDIAN_CITIES } from "@/lib/cities";

const KEY = "kutchi-hub:city";
const COORDS_KEY = "kutchi-hub:city-coords";
const EVT = "kutchi-hub:city-changed";
const AUTO_TRIED_KEY = "kutchi-hub:city-auto-tried";

/**
 * The stored value for the explicit choice "All locations". It is saved like a city, so a reload keeps it and the
 * first-visit auto-detect (which only runs when nothing is stored) never overrides it. Nothing outside this file sees
 * it: `city` is null for it, exactly like "no city filter", so no query can send it (or an empty string) as a city.
 */
export const ALL_LOCATIONS = "__all__";

/** Where the chosen place is (from the autocomplete details or the device), used to find nearby cities. */
export type CityCoords = { lat: number; lng: number };

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

// Coordinates only count for the city they were saved with (a city picked from the plain list has none).
function readCoords(city: string | null): CityCoords | null {
  if (typeof window === "undefined" || !city) return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(COORDS_KEY) ?? "null") as
      | { city?: string; lat?: number; lng?: number }
      | null;
    if (raw && raw.city === city && typeof raw.lat === "number" && typeof raw.lng === "number") {
      return { lat: raw.lat, lng: raw.lng };
    }
  } catch {
    /* ignore corrupt value */
  }
  return null;
}

function store(next: string | null, coords?: CityCoords | null) {
  if (next) window.localStorage.setItem(KEY, next);
  else window.localStorage.removeItem(KEY);
  if (next && coords) window.localStorage.setItem(COORDS_KEY, JSON.stringify({ city: next, ...coords }));
  else window.localStorage.removeItem(COORDS_KEY);
}

export function useCity() {
  // The raw stored value: a city, ALL_LOCATIONS, or null (nothing chosen yet / not read yet).
  const [stored, setStored] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState<CityCoords | null>(null);

  useEffect(() => {
    const first = read();
    setStored(first);
    setCoords(readCoords(first === ALL_LOCATIONS ? null : first));
    setLoaded(true);
    const onChange = () => {
      const now = read();
      setStored(now);
      setCoords(readCoords(now === ALL_LOCATIONS ? null : now));
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);

    // Auto-detect once per browser if no choice is stored yet ("All locations" counts as a choice).
    if (!first && !window.localStorage.getItem(AUTO_TRIED_KEY)) {
      window.localStorage.setItem(AUTO_TRIED_KEY, "1");
      (async () => {
        try {
          const loc = await getCurrentLocation();
          const place = await reverseGeocodeCity({ data: { lat: loc.latitude, lng: loc.longitude } });
          const next = resolveDetectedCity(place, INDIAN_CITIES);
          if (!next) return;
          // The person may have picked something (e.g. All locations) while the location was being found.
          if (read()) return;
          store(next, { lat: loc.latitude, lng: loc.longitude });
          window.dispatchEvent(new Event(EVT));
        } catch {
          // silently ignore — user can pick manually
        }
      })();
    }

    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const allLocations = stored === ALL_LOCATIONS;
  // A real city, or null for "All locations" and "nothing chosen": every consumer treats both as "no city filter".
  const city = allLocations ? null : stored;

  const setCity = useCallback((next: string | null, at?: CityCoords | null) => {
    if (typeof window === "undefined") return;
    store(next, at);
    window.dispatchEvent(new Event(EVT));
    setStored(next);
    setCoords(next && at ? at : null);
  }, []);

  /** The explicit choice "All locations": no city filter anywhere, remembered across reloads. */
  const setAllLocations = useCallback(() => {
    if (typeof window === "undefined") return;
    store(ALL_LOCATIONS, null);
    window.dispatchEvent(new Event(EVT));
    setStored(ALL_LOCATIONS);
    setCoords(null);
  }, []);

  return { city, coords, allLocations, loaded, setCity, setAllLocations };
}
