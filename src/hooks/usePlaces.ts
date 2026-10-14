import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessCities, getPlaceDetails, searchPlaces } from "@/lib/places.functions";
import type { PlaceSuggestion } from "@/lib/places";
import { CITIES_BY_STATE, INDIAN_CITIES } from "@/lib/cities";
import { cityAliasTargets, cityFromPickedPlace, cleanPlaceName } from "@/lib/geolocation";
import type { CityCoords } from "@/hooks/useCity";

const DEBOUNCE_MS = 300;

function newSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Google Places autocomplete for towns and villages. 300 ms debounce, 2+ characters, one session token per
 * search-and-pick (`resetSession` after a pick or when the picker closes). Errors just give an empty list,
 * so the local city list keeps working.
 */
export function usePlaceSearch(query: string, enabled = true) {
  const search = useServerFn(searchPlaces);
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const token = useRef(newSessionToken());

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await search({ data: { query: q, sessionToken: token.current } });
        if (!stale) setPlaces(res.places);
      } catch {
        if (!stale) setPlaces([]);
      } finally {
        if (!stale) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabled]);

  const resetSession = useCallback(() => {
    token.current = newSessionToken();
  }, []);
  return { places, loading, sessionToken: () => token.current, resetSession };
}

/** Turns a picked suggestion into the city name to store (aliases + district rule applied) and its coordinates. */
export function usePickPlace() {
  const details = useServerFn(getPlaceDetails);
  return useCallback(
    async (place: PlaceSuggestion, sessionToken: string): Promise<{ city: string; coords: CityCoords | null }> => {
      let res: Awaited<ReturnType<typeof details>> | null = null;
      try {
        res = await details({ data: { placeId: place.placeId, sessionToken } });
      } catch {
        /* keep the name without coordinates */
      }
      const d = res?.details ?? null;
      return {
        city: cityFromPickedPlace(place.name, d?.district ?? null, INDIAN_CITIES),
        coords: d ? { lat: d.lat, lng: d.lng } : null,
      };
    },
    [details],
  );
}

export type LocalCity = { city: string; count: number };

/** Cities with published businesses, most businesses first. Empty until loaded (or when the lookup fails). */
export function useBusinessCities() {
  const { data } = useQuery({
    queryKey: ["business-cities"],
    queryFn: () => getBusinessCities(),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => [...(data ?? [])].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)), [data]);
}

/** Our own list (INDIAN_CITIES plus any city that has businesses) matching what was typed; cities with businesses first. */
export function matchLocalCities(query: string, businessCities: LocalCity[], limit = 8): LocalCity[] {
  const q = cleanPlaceName(query);
  if (!q) return [];
  const counts = new Map(businessCities.map((c) => [cleanPlaceName(c.city), c]));
  const names = new Map<string, string>();
  for (const c of INDIAN_CITIES) names.set(cleanPlaceName(c), c);
  for (const c of businessCities) if (!names.has(cleanPlaceName(c.city))) names.set(cleanPlaceName(c.city), c.city);

  const aliasHits = new Set(cityAliasTargets(query).map(cleanPlaceName));
  const hits = [...names]
    .filter(([key]) => key.includes(q) || aliasHits.has(key))
    .map(([key, city]) => ({
      city,
      count: counts.get(key)?.count ?? 0,
      prefix: key.startsWith(q) || aliasHits.has(key),
    }));
  hits.sort(
    (a, b) =>
      Number(b.count > 0) - Number(a.count > 0) ||
      Number(b.prefix) - Number(a.prefix) ||
      b.count - a.count ||
      a.city.localeCompare(b.city),
  );
  return hits.slice(0, limit).map(({ city, count }) => ({ city, count }));
}

/**
 * Google suggestions that are not just one of our listed cities again: same spelling AND same state
 * (a "Kalol" in another state is a different place and stays in the list).
 */
export function otherPlaces(places: PlaceSuggestion[], local: LocalCity[]): PlaceSuggestion[] {
  const statesOf = new Map<string, string[]>();
  for (const group of CITIES_BY_STATE) {
    for (const c of group.cities) {
      const key = cleanPlaceName(c);
      statesOf.set(key, [...(statesOf.get(key) ?? []), group.state]);
    }
  }
  // Cities that only exist because they have businesses are treated as Gujarat (where nearly all our data is).
  for (const l of local) if (!statesOf.has(cleanPlaceName(l.city))) statesOf.set(cleanPlaceName(l.city), ["Gujarat"]);
  return places.filter((p) => {
    const states = statesOf.get(cleanPlaceName(p.name.split(",")[0]));
    return !states?.some((s) => p.secondary.includes(s));
  });
}
