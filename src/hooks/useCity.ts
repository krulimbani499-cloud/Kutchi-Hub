import { useEffect, useState, useCallback } from "react";
import { getCurrentLocation } from "@/lib/geolocation";
import { reverseGeocodeCity } from "@/lib/maps.functions";
import { getBusinessCities } from "@/lib/places.functions";
import { resolveDetectedPlace } from "@/lib/area";
import { INDIAN_CITIES } from "@/lib/cities";

const KEY = "kutchi-hub:city";
const COORDS_KEY = "kutchi-hub:city-coords";
const AREA_KEY = "kutchi-hub:city-area";
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

/**
 * A locality inside the chosen city ("Naroda" inside "Ahmedabad"): the businesses shown are the city's, nearest to this place
 * first. `lat` / `lng` is where the locality is (the same numbers as `coords`).
 */
export type CityArea = { name: string; lat: number; lng: number };

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

// The area only counts for the city it was saved with, and needs the coordinates of the place.
function readArea(city: string | null, coords: CityCoords | null): CityArea | null {
  if (typeof window === "undefined" || !city || !coords) return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(AREA_KEY) ?? "null") as { city?: string; name?: string } | null;
    if (raw && raw.city === city && typeof raw.name === "string" && raw.name.trim()) {
      return { name: raw.name.trim(), lat: coords.lat, lng: coords.lng };
    }
  } catch {
    /* ignore corrupt value */
  }
  return null;
}

function store(next: string | null, coords?: CityCoords | null, area?: string | null) {
  if (next) window.localStorage.setItem(KEY, next);
  else window.localStorage.removeItem(KEY);
  if (next && coords) window.localStorage.setItem(COORDS_KEY, JSON.stringify({ city: next, ...coords }));
  else window.localStorage.removeItem(COORDS_KEY);
  // The locality is remembered with the city (picking another city, or All locations, forgets it).
  if (next && coords && area) window.localStorage.setItem(AREA_KEY, JSON.stringify({ city: next, name: area }));
  else window.localStorage.removeItem(AREA_KEY);
}

export function useCity() {
  // The raw stored value: a city, ALL_LOCATIONS, or null (nothing chosen yet / not read yet).
  const [stored, setStored] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState<CityCoords | null>(null);
  const [area, setArea] = useState<CityArea | null>(null);

  useEffect(() => {
    const apply = () => {
      const now = read();
      const city = now === ALL_LOCATIONS ? null : now;
      const c = readCoords(city);
      setStored(now);
      setCoords(c);
      setArea(readArea(city, c));
    };
    apply();
    setLoaded(true);
    window.addEventListener(EVT, apply);
    window.addEventListener("storage", apply);

    // Auto-detect once per browser if no choice is stored yet ("All locations" counts as a choice).
    if (!read() && !window.localStorage.getItem(AUTO_TRIED_KEY)) {
      window.localStorage.setItem(AUTO_TRIED_KEY, "1");
      (async () => {
        try {
          const loc = await getCurrentLocation();
          const place = await reverseGeocodeCity({ data: { lat: loc.latitude, lng: loc.longitude } });
          // The cities that have businesses decide whether a locality (Naroda) is shown as its parent city (Ahmedabad).
          const businessCities = await getBusinessCities().catch(() => []);
          const resolved = resolveDetectedPlace(place, INDIAN_CITIES, businessCities.map((c) => c.city));
          if (!resolved) return;
          // The person may have picked something (e.g. All locations) while the location was being found.
          if (read()) return;
          store(resolved.city, { lat: loc.latitude, lng: loc.longitude }, resolved.area);
          window.dispatchEvent(new Event(EVT));
        } catch {
          // silently ignore — user can pick manually
        }
      })();
    }

    return () => {
      window.removeEventListener(EVT, apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  const allLocations = stored === ALL_LOCATIONS;
  // A real city, or null for "All locations" and "nothing chosen": every consumer treats both as "no city filter".
  const city = allLocations ? null : stored;

  const setCity = useCallback((next: string | null, at?: CityCoords | null, areaName?: string | null) => {
    if (typeof window === "undefined") return;
    store(next, at, areaName);
    window.dispatchEvent(new Event(EVT));
    setStored(next);
    setCoords(next && at ? at : null);
    setArea(next && at && areaName ? { name: areaName, lat: at.lat, lng: at.lng } : null);
  }, []);

  /** The explicit choice "All locations": no city filter anywhere, remembered across reloads. */
  const setAllLocations = useCallback(() => {
    if (typeof window === "undefined") return;
    store(ALL_LOCATIONS, null);
    window.dispatchEvent(new Event(EVT));
    setStored(ALL_LOCATIONS);
    setCoords(null);
    setArea(null);
  }, []);

  return { city, coords, area, allLocations, loaded, setCity, setAllLocations };
}
