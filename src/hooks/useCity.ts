import { useEffect, useState, useCallback } from "react";
import { getCurrentLocation, resolveDetectedCity } from "@/lib/geolocation";
import { reverseGeocodeCity } from "@/lib/maps.functions";
import { INDIAN_CITIES } from "@/lib/cities";

const KEY = "kutchi-hub:city";
const COORDS_KEY = "kutchi-hub:city-coords";
const EVT = "kutchi-hub:city-changed";
const AUTO_TRIED_KEY = "kutchi-hub:city-auto-tried";

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
  const [city, setCityState] = useState<string | null>(null);
  const [coords, setCoords] = useState<CityCoords | null>(null);

  useEffect(() => {
    const stored = read();
    setCityState(stored);
    setCoords(readCoords(stored));
    const onChange = () => {
      const now = read();
      setCityState(now);
      setCoords(readCoords(now));
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);

    // Auto-detect once per browser if no city stored yet.
    if (!stored && !window.localStorage.getItem(AUTO_TRIED_KEY)) {
      window.localStorage.setItem(AUTO_TRIED_KEY, "1");
      (async () => {
        try {
          const loc = await getCurrentLocation();
          const place = await reverseGeocodeCity({ data: { lat: loc.latitude, lng: loc.longitude } });
          const next = resolveDetectedCity(place, INDIAN_CITIES);
          if (!next) return;
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

  const setCity = useCallback((next: string | null, at?: CityCoords | null) => {
    if (typeof window === "undefined") return;
    store(next, at);
    window.dispatchEvent(new Event(EVT));
    setCityState(next);
    setCoords(next && at ? at : null);
  }, []);

  return { city, coords, setCity };
}
