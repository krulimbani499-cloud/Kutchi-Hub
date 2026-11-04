// The "Other locations" part of the results page: the chosen city's matches first, then the matches of the other cities, the nearest
// city first. Pure functions (no database, no browser), shared by the server query, the page and the tests.
import { cityKey, haversineKm } from "./places";

export type Point = { lat: number; lng: number };
type Located = { city: string | null; latitude: number | null; longitude: number | null };

const key = (city: string | null | undefined) => cityKey(city ?? "");

/**
 * Where each city is. A city we know the centre of (`known`) uses it; any other city is the average place of its businesses that have
 * coordinates. A city with neither is left out (it is ordered last).
 */
export function cityCentres(rows: Located[], known: (cityKey: string) => Point | null | undefined): Map<string, Point> {
  const sums = new Map<string, { lat: number; lng: number; n: number }>();
  for (const r of rows) {
    const k = key(r.city);
    if (!k || r.latitude == null || r.longitude == null) continue;
    const s = sums.get(k) ?? { lat: 0, lng: 0, n: 0 };
    s.lat += r.latitude;
    s.lng += r.longitude;
    s.n += 1;
    sums.set(k, s);
  }
  const out = new Map<string, Point>();
  for (const [k, s] of sums) out.set(k, { lat: s.lat / s.n, lng: s.lng / s.n });
  // Known centres win, also for a city none of whose businesses has coordinates.
  for (const r of rows) {
    const k = key(r.city);
    if (!k) continue;
    const c = known(k);
    if (c) out.set(k, c);
  }
  return out;
}

/**
 * Orders the other cities' businesses: the city nearest to `from` first (every business of one city together, in the order they came in,
 * e.g. package tier), then the next city. A city whose place is unknown goes after the others, A-Z. With no `from`, A-Z by city.
 */
export function orderByNearestCity<T extends { city: string | null }>(rows: T[], from: Point | null, centres: Map<string, Point>): T[] {
  const dist = (city: string | null) => {
    const c = centres.get(key(city));
    return from && c ? haversineKm(from.lat, from.lng, c.lat, c.lng) : Infinity;
  };
  const withDist = rows.map((row, i) => ({ row, i, d: dist(row.city), k: key(row.city) }));
  withDist.sort((a, b) => (a.d === b.d ? 0 : a.d < b.d ? -1 : 1) || a.k.localeCompare(b.k) || a.i - b.i);
  return withDist.map((x) => x.row);
}

export type SplitPage<T> = {
  items: Array<T & { section: "city" | "other" }>;
  total: number;
  hasMore: boolean;
};

/** One page of "the city's list, then the other cities' list" (20 at a time over the two lists as one). */
export function pageOfSplit<T>(cityList: T[], otherList: T[], offset: number, limit: number): SplitPage<T> {
  const total = cityList.length + otherList.length;
  const items: SplitPage<T>["items"] = [];
  for (let i = offset; i < Math.min(offset + limit, total); i++) {
    items.push(i < cityList.length ? { ...cityList[i], section: "city" } : { ...otherList[i - cityList.length], section: "other" });
  }
  return { items, total, hasMore: offset + items.length < total };
}
