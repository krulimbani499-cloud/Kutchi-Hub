// ONE place for "how long may PUBLIC data be old" (CPU saving on Vercel). Pure: no server imports, so it can be tested anywhere.
//
// Two layers keep public pages cheap:
//   1. the Vercel CDN keeps the HTML of public pages for a short time (Cache-Control: s-maxage + stale-while-revalidate), so
//      visitors and crawlers are served without running the page code again;
//   2. each server instance keeps the answers of the heavy public queries in memory (server-cache.ts).
// Both layers can be old at the same time, so the numbers are chosen so that, added up, a change made by an admin / owner shows up
// on the public site within 5 minutes at the latest (see WORST_CASE_SECONDS below, checked by the numbers in this file).
// Never used for anything per-user, for the dashboard, for the admin screens or for the API.

/** How long (seconds) a server instance keeps each kind of public answer. */
export const MEMORY_TTL_S = {
  /** One page of search results (and, one level below, the full ordered result list that its pages are cut from). */
  search: 30,
  /** The home page's lists (featured, offers, platinum spotlight, popular categories). */
  home: 120,
  /** Business counts per category (Popular Categories, All Categories). */
  counts: 150,
  /** The category list itself. */
  categories: 120,
  /** The map of the directory (which cities / categories have businesses): the landing pages and the sitemap read it. */
  directory: 90,
  /** The category / city / city + category landing pages (their directory map is cached on its own, see `directory`). */
  landing: 60,
  /** The banner ads of one slot / city. */
  banners: 60,
  /** One business page, without its reviews (reviews are always read live, so a new review shows at once). */
  business: 60,
  /** Everything the sitemap lists. */
  sitemap: 600,
} as const;

/** CDN profiles: how long the edge may serve a copy as fresh, and how long more it may serve it while it refreshes in the background. */
export const EDGE = {
  /** Home, business, category, city, search shell ...: pages whose content comes from the directory. */
  page: { sMaxAge: 60, swr: 60 },
  /** Pages built from the plans table (pricing): rarely changed. */
  slow: { sMaxAge: 120, swr: 120 },
  /** Pages that hardly ever change (about, privacy). */
  static: { sMaxAge: 3600, swr: 86400 },
  /** The sitemap: only crawlers read it. */
  sitemap: { sMaxAge: 3600, swr: 86400 },
} as const;
export type EdgeProfile = keyof typeof EDGE;

/**
 * The longest a change can stay invisible on the public pages that show it:
 * memory (directory, the slowest) + the page's own memory cache (landing pages have none, a business page has `business`) + the CDN's
 * fresh time + the CDN's stale time. Must stay at or under 5 minutes.
 */
export const WORST_CASE_SECONDS = Math.max(
  MEMORY_TTL_S.directory + MEMORY_TTL_S.landing + EDGE.page.sMaxAge + EDGE.page.swr, // category / city / city+category pages
  MEMORY_TTL_S.business + EDGE.page.sMaxAge + EDGE.page.swr, //             business page (its HTML)
  MEMORY_TTL_S.counts + EDGE.page.sMaxAge + EDGE.page.swr, //               All Categories (HTML)
  MEMORY_TTL_S.home + MEMORY_TTL_S.counts, //                               home lists (the lists are cached on top of the counts)
  MEMORY_TTL_S.search * 2, //                                               search page = list + page
);

export function cacheControl(profile: EdgeProfile): string {
  const { sMaxAge, swr } = EDGE[profile];
  // max-age=0: browsers ask the CDN each time (always get the CDN's copy); the CDN itself serves it for s-maxage.
  return `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}

/**
 * Which edge profile a page address may use, or null = never cache (logged-in pages, dashboard, admin, auth, API, server functions
 * and every address that is not listed). A whitelist: a new page is NOT cached until it is added here on purpose.
 */
export function edgeProfileFor(pathname: string): EdgeProfile | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (p === "/" || p === "/categories" || p === "/all-business" || p === "/search" || p === "/events") return "page";
  if (p === "/pricing") return "slow";
  if (p === "/about" || p === "/privacy") return "static";
  // /business/new is the (logged-in) add-a-business form, not a business page.
  if (p === "/business/new") return null;
  if (/^\/(business|category|city)\/[^/]+$/.test(p)) return "page";
  if (/^\/city\/[^/]+\/category\/[^/]+$/.test(p)) return "page";
  return null;
}

/**
 * Whether THIS request/response pair may be given the CDN header. Only a plain page view (GET / HEAD, no Authorization, no cookie
 * being set, status 200, HTML) of a whitelisted address: never an error, a redirect, a 404 or anything that already says private /
 * no-store.
 */
export function mayEdgeCache(input: { method: string; pathname: string; hasAuthorization: boolean; hasAuthCookie?: boolean; status: number; contentType: string; setsCookie: boolean; cacheControl: string | null }): EdgeProfile | null {
  if (input.method !== "GET" && input.method !== "HEAD") return null;
  if (input.hasAuthorization || input.hasAuthCookie || input.setsCookie || input.status !== 200) return null;
  if (!input.contentType.toLowerCase().includes("text/html")) return null;
  if (input.cacheControl && /(no-store|private|no-cache)/i.test(input.cacheControl)) return null;
  return edgeProfileFor(input.pathname);
}

/**
 * Does the request carry a login cookie (Supabase's sb-* cookies, or anything named like an auth / session token)? This site keeps
 * the login in the browser's localStorage and the server renders the same page for everybody, so normally no such cookie exists.
 * It is a belt-and-braces rule: a request that has one is answered `private, no-store`, so its response can never be stored for others.
 */
export function hasAuthCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => {
    const name = part.split("=")[0].trim().toLowerCase();
    return name.startsWith("sb-") || name.startsWith("supabase") || /(auth|session|access|refresh).*(token)|^(token|jwt|session|sid)$/.test(name);
  });
}
