// The filters of the results page: what is allowed in the address (so a shared link always opens the same list), the sort
// options, and the wording of the page heading. Pure functions (no database, no browser), shared by the page and its tests.

export const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "Rating" },
  { value: "nearest", label: "Nearest" },
  { value: "newest", label: "Newest" },
  // Kept because the home page links to /search?sort=discount ("see all offers").
  { value: "discount", label: "Top discount" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** What the address of the results page can carry. Every key is optional and left out when it is "off" / the default. */
export type SearchParams = {
  q?: string;
  category?: string;
  city?: string;
  sort?: Exclude<SortValue, "relevance">;
  /** Minimum average rating (the "Rating 4+" chip sets 4). */
  rating?: number;
  open?: boolean;
  verified?: boolean;
  offer?: boolean;
};

/** `city=all` in the address means "every city" on purpose, even when the header has a city chosen. */
export const CITY_ALL = "all";

const MAX_TEXT = 100;

const text = (v: unknown): string | undefined => {
  // The router turns "123" into the number 123 and "true" into a boolean: put them back into text.
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v === "boolean") v = String(v);
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, MAX_TEXT);
  return s || undefined;
};

const flag = (v: unknown): boolean => v === true || v === 1 || v === "1" || (typeof v === "string" && v.toLowerCase() === "true");

/** Cleans whatever is in the address into SearchParams: unknown or malformed values are dropped, never an error. */
export function validateSearchParams(raw: Record<string, unknown>): SearchParams {
  const out: SearchParams = {};
  const q = text(raw.q);
  if (q) out.q = q;
  const category = text(raw.category);
  if (category && category !== "all") out.category = category;
  const city = text(raw.city);
  if (city) out.city = city;
  const sort = text(raw.sort);
  if (sort && sort !== "relevance" && SORT_OPTIONS.some((o) => o.value === sort)) out.sort = sort as SearchParams["sort"];
  const rating = typeof raw.rating === "number" ? raw.rating : Number(raw.rating);
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) out.rating = Math.round(rating * 10) / 10;
  if (flag(raw.open)) out.open = true;
  if (flag(raw.verified)) out.verified = true;
  if (flag(raw.offer)) out.offer = true;
  return out;
}

/** The city the list is for: the address wins ("all" = every city), otherwise the city chosen in the header, otherwise none. */
export function effectiveCity(urlCity: string | undefined, headerCity: string | null | undefined): string {
  if (urlCity === CITY_ALL) return "";
  return urlCity ?? headerCity ?? "";
}

/**
 * How many filters are switched on (the number shown on the "All Filters" button): the text search and the four chips. The sort,
 * the city and the category are not counted: the page heading already says them.
 */
export function activeFilterCount(p: SearchParams): number {
  return [p.q, p.rating, p.open, p.verified, p.offer].filter((v) => v !== undefined && v !== false).length;
}

/** The page heading: "Top Dentists in Bhuj". */
export function resultsHeading(o: { q?: string; categoryName?: string | null; city?: string | null }): string {
  const city = o.city?.trim();
  const cat = o.categoryName?.trim();
  const q = o.q?.trim();
  if (cat) return city ? `Top ${cat} in ${city}` : `Top ${cat}`;
  if (q) return city ? `“${q}” in ${city}` : `Results for “${q}”`;
  return city ? `Top businesses in ${city}` : "Find businesses";
}

/** "12+ Listings" for the breadcrumb (the number is the exact total of matches). */
export function listingCountLabel(total: number): string {
  return `${total}+ ${total === 1 ? "Listing" : "Listings"}`;
}

/** "350 m", "2.4 km", "18 km". */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** The same filters as a plain query string for a link (used by the category / city pages: "Filter and sort"). */
export function searchQueryString(p: SearchParams): string {
  const usp = new URLSearchParams();
  if (p.q) usp.set("q", p.q);
  if (p.category) usp.set("category", p.category);
  if (p.city) usp.set("city", p.city);
  if (p.sort) usp.set("sort", p.sort);
  if (p.rating) usp.set("rating", String(p.rating));
  if (p.open) usp.set("open", "true");
  if (p.verified) usp.set("verified", "true");
  if (p.offer) usp.set("offer", "true");
  return usp.toString();
}
