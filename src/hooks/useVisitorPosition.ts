import { useCallback, useEffect, useState } from "react";
import { getCurrentLocation } from "@/lib/geolocation";

export type Position = { lat: number; lng: number };

const GEO_KEY = "kh:search-geo";
const GEO_TTL_MS = 30 * 60_000;

/** About 100 m: a stable value for the query key and nothing more precise than the page needs. */
export const roundPos = (p: Position): Position => ({ lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 });

function readStoredPosition(): Position | null {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(GEO_KEY) ?? "null") as { lat?: number; lng?: number; t?: number } | null;
    if (raw && typeof raw.lat === "number" && typeof raw.lng === "number" && typeof raw.t === "number" && Date.now() - raw.t < GEO_TTL_MS) {
      return { lat: raw.lat, lng: raw.lng };
    }
  } catch {
    /* storage unavailable: just ask again */
  }
  return null;
}

/**
 * Where the visitor is: needed for "Nearest" and for the distance on each result. The position is only asked for when `askPosition`
 * is called (the person picked "Nearest"), remembered for 30 minutes of this visit, and never leaves the device except as the
 * rounded numbers of one search.
 */
export function useVisitorPosition() {
  const [geo, setGeo] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    const stored = readStoredPosition();
    if (stored) setGeo(stored);
  }, []);
  const askPosition = useCallback(async (): Promise<Position | null> => {
    setLocating(true);
    try {
      const fix = await getCurrentLocation();
      const pos = roundPos({ lat: fix.latitude, lng: fix.longitude });
      setGeo(pos);
      try {
        window.sessionStorage.setItem(GEO_KEY, JSON.stringify({ ...pos, t: Date.now() }));
      } catch {
        /* private mode: the position just is not remembered */
      }
      return pos;
    } catch {
      return null;
    } finally {
      setLocating(false);
    }
  }, []);
  return { geo, locating, askPosition };
}
