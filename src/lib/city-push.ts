// City push notifications ("New business in Ahmedabad: <name> (<category>)"): the rules, as pure functions.
// No database, no browser, no network: the same facts always give the same answer, so the daily limit, the quiet hours, the
// summary and the wording can be tested on their own. The sender (city-push.server.ts) and the web client (web-push.ts) use them.
import { canonicalCityName } from "./geolocation";
import { citySlug } from "./seo-landing";

/** At most this many single "New business in ..." notifications per city per day (India time). The rest go in one evening summary. */
export const MAX_SINGLE_PER_DAY = 3;
/** No notification between 21:00 and 08:00 India time; what is waiting goes out after 08:00. */
export const QUIET_FROM_HOUR = 21;
export const QUIET_TO_HOUR = 8;
/** The evening summary goes out from 19:00 (and, because of the quiet hours, before 21:00). */
export const SUMMARY_FROM_HOUR = 19;
/** A waiting business that cannot be announced (not visible to the public, no sender) is dropped after this long. */
export const QUEUE_TTL_HOURS = 72;
/** A business whose notification failed this many times is given up. */
export const MAX_ATTEMPTS = 3;
/** Who is notified: the platforms a token can come from. */
export const PUSH_PLATFORMS = ["web", "android", "ios"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** The key of a city as people follow it: "Dehgam" and "Dahegam" are one city, "Vadagam (Aravalli)" -> "vadagam-aravalli". */
export function cityKeyFor(city: string): string {
  return citySlug(canonicalCityName(String(city ?? "").trim()));
}

/** How the city is written in the notification. */
export function cityLabelFor(city: string): string {
  return canonicalCityName(String(city ?? "").trim()).replace(/\s+/g, " ").trim();
}

// ---- India time (IST = UTC+5:30, no daylight saving)

export type IstClock = { day: string; hour: number; minute: number };

export function istClock(now: Date): IstClock {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return { day: ist.toISOString().slice(0, 10), hour: ist.getUTCHours(), minute: ist.getUTCMinutes() };
}

export const inQuietHours = (hour: number): boolean => hour >= QUIET_FROM_HOUR || hour < QUIET_TO_HOUR;
/** The time of the evening summary: from 19:00 until the quiet hours start. */
export const inSummaryWindow = (hour: number): boolean => hour >= SUMMARY_FROM_HOUR && hour < QUIET_FROM_HOUR;

// ---- the daily limit

/**
 * `waiting`: the businesses to announce, oldest first. `singlesToday`: how many single notifications this city already had today.
 * Returns the ones to announce now (never more than the limit allows) and the ones that wait for the evening summary.
 */
export function planCity<T>(waiting: readonly T[], singlesToday: number, max: number = MAX_SINGLE_PER_DAY): { send: T[]; hold: T[] } {
  const room = Math.max(0, max - Math.max(0, singlesToday));
  return { send: waiting.slice(0, room), hold: waiting.slice(room) };
}

// ---- the wording

export type PushText = { title: string; body: string; link: string; tag: string };

/** "New business in Ahmedabad" / "Umiya Wood Engineering (Wood Working Machinery)", opens the business page. */
export function singleText(cityLabel: string, name: string, category: string | null | undefined, slug: string): PushText {
  const cat = String(category ?? "").trim();
  return {
    title: `New business in ${cityLabel}`,
    body: cat ? `${name} (${cat})` : name,
    link: `/business/${slug}`,
    tag: `biz-${slug}`.slice(0, 60),
  };
}

/** "5 more new businesses in Ahmedabad today", opens the newest businesses of the city. */
export function summaryText(cityLabel: string, count: number, cityKey: string): PushText {
  return {
    title: `New businesses in ${cityLabel}`,
    body: count === 1 ? `1 more new business was added today` : `${count} more new businesses were added today`,
    link: `/all-business?city=${encodeURIComponent(cityKey)}&sort=newest`,
    tag: `summary-${cityKey}`.slice(0, 60),
  };
}

// ---- what a browser / phone may send us

/** A plausible FCM registration token (they are 140-200 characters of letters, digits, : - _ ). Not a proof: FCM is asked as well. */
export function isPlausibleToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 20 && token.length <= 4096 && /^[A-Za-z0-9:_\-.]+$/.test(token);
}

/** A same-site address from a notification ("/business/x"): anything else is not followed. */
export function safeInternalLink(link: unknown): string {
  return typeof link === "string" && /^\/(?!\/)[^\s]*$/.test(link) ? link : "/";
}
