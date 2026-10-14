// Pure helpers for Google Maps links (no env, no network). Relative imports carry the .ts extension so
// scripts/backfill-coords.mjs can load this file directly with Node.
import { isInIndia } from "./geocode.ts";

export type LatLng = { lat: number; lng: number };

const NUM = "(-?\\d{1,3}\\.\\d+)";

// Most precise first: !3d..!4d.. is the pin itself, @lat,lng is the map centre (close to the pin for /place/ links).
const COORD_PATTERNS: RegExp[] = [
  new RegExp(`!3d${NUM}!4d${NUM}`),
  new RegExp(`@${NUM},${NUM}`),
  new RegExp(`[?&](?:q|ll|query|destination|daddr|saddr|center)=\\s*(?:loc:)?\\s*${NUM}\\s*,\\s*${NUM}`),
  new RegExp(`/maps/(?:place|search|dir)/\\s*\\+?${NUM}\\s*,\\s*\\+?${NUM}`),
];

/** Coordinates written in a Maps URL (a place pin, "@lat,lng", "?q=lat,lng", "ll=") that are inside India, else null. */
export function coordsFromMapsUrl(raw: string): LatLng | null {
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    /* keep as is */
  }
  for (const pattern of COORD_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && isInIndia(lat, lng)) {
      return { lat, lng };
    }
  }
  return null;
}

// Links we may follow server-side. Anything else is never fetched (no SSRF through a user supplied URL).
const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "share.google"]);

export function isShortLinkHost(host: string): boolean {
  return SHORT_LINK_HOSTS.has(host.toLowerCase());
}

export function isAllowedGoogleHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    isShortLinkHost(h) ||
    h === "google.com" ||
    h.endsWith(".google.com") ||
    h === "google.co.in" ||
    h.endsWith(".google.co.in")
  );
}

/** A plain https URL on an allowed Google host (no credentials, default port), or null. */
export function parseAllowedGoogleUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  return isAllowedGoogleHost(u.hostname) ? u : null;
}

/**
 * The place the link points at, as text: "/maps/place/<Name, address>/data=…" or "/maps?q=<text>".
 * Short links redirect to exactly this form (the name and address as Google knows them, no coordinates).
 */
export function placeTextFromMapsUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const isMaps = u.pathname.startsWith("/maps") || u.hostname === "maps.google.com";
  if (!isMaps) return null;
  let text: string | null = null;
  const seg = u.pathname.match(/^\/maps\/(?:place|search)\/([^/]+)/);
  if (seg) text = seg[1];
  else text = u.searchParams.get("q") ?? u.searchParams.get("query");
  if (!text) return null;
  try {
    text = decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    text = text.replace(/\+/g, " ");
  }
  text = text.replace(/\s+/g, " ").trim();
  // Needs real words (not just a coordinate pair or an id).
  return text.length >= 6 && /[A-Za-zऀ-෿]{3,}/.test(text) ? text.slice(0, 300) : null;
}
