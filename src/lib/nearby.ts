// Pure ranking for the "Nearby Businesses" section (no database, so it can be tested on its own).
import { haversineKm } from "./places.ts";

export const NEARBY_RADIUS_KM = 25;
export const NEARBY_WIDE_RADIUS_KM = 50;
export const NEARBY_MIN_RESULTS = 4;

/**
 * Businesses with coordinates, nearest first, within 25 km. When that gives fewer than 4, the radius widens to 50 km.
 * Rows without coordinates are ignored.
 */
export function rankNearby<T extends { latitude: number | null; longitude: number | null }>(
  rows: T[],
  lat: number,
  lng: number,
  limit: number,
): { radiusKm: number; businesses: Array<T & { distanceKm: number }> } {
  const all = rows
    .filter((b): b is T & { latitude: number; longitude: number } => b.latitude != null && b.longitude != null)
    .map((b) => ({ ...b, distanceKm: haversineKm(lat, lng, b.latitude, b.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const within = all.filter((b) => b.distanceKm <= NEARBY_RADIUS_KM).length;
  const radiusKm = within >= NEARBY_MIN_RESULTS ? NEARBY_RADIUS_KM : NEARBY_WIDE_RADIUS_KM;
  return { radiusKm, businesses: all.filter((b) => b.distanceKm <= radiusKm).slice(0, limit) };
}
