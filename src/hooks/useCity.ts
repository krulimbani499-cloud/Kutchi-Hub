import { useEffect, useState, useCallback } from "react";
import { getCurrentLocation, reverseGeocode, extractCity } from "@/lib/geolocation";
import { INDIAN_CITIES } from "@/lib/cities";

const KEY = "kutchi-hub:city";
const EVT = "kutchi-hub:city-changed";
const AUTO_TRIED_KEY = "kutchi-hub:city-auto-tried";

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function useCity() {
  const [city, setCityState] = useState<string | null>(null);

  useEffect(() => {
    const stored = read();
    setCityState(stored);
    const onChange = () => setCityState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);

    // Auto-detect once per browser if no city stored yet.
    if (!stored && !window.localStorage.getItem(AUTO_TRIED_KEY)) {
      window.localStorage.setItem(AUTO_TRIED_KEY, "1");
      (async () => {
        try {
          const loc = await getCurrentLocation();
          const rg = await reverseGeocode(loc.latitude, loc.longitude);
          const detected = extractCity(rg);
          if (!detected) return;
          const match = INDIAN_CITIES.find(
            (c) => c.toLowerCase() === detected.toLowerCase(),
          );
          const next = match ?? detected;
          window.localStorage.setItem(KEY, next);
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

  const setCity = useCallback((next: string | null) => {
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
    setCityState(next);
  }, []);

  return { city, setCity };
}