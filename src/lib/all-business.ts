// The "All Business" page (every published business, every city): search text cleaning, the default order and the result line.
// Pure functions (no database, no browser), shared by the server query, the page and the tests.

/** Fewer characters than this: no text search (the whole list is shown). */
export const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 60;

/**
 * The search text made safe for a database pattern: characters that act as wildcards or as separators inside a filter string
 * (% _ * \ , ( ) ") become spaces, white space is collapsed, the length is limited. "" = nothing to search for.
 */
export function cleanSearchTerm(q: string | null | undefined): string {
  const t = String(q ?? "")
    .replace(/[%_*\\,()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TERM_LENGTH)
    .trim();
  return t.length >= MIN_TERM_LENGTH ? t : "";
}

export type TopOrderable = {
  id: string;
  plan_tier_order?: number | null;
  avgRating?: number | null;
  created_at?: string | null;
};

/**
 * The tier of a package for ordering and for the section dividers: 5 Enterprise, 4 Platinum, 3 Gold, 2 Silver; the Free plan (1)
 * and a business without any plan (0) are one group, 0.
 */
export function tierGroup(tier: number | null | undefined): 5 | 4 | 3 | 2 | 0 {
  const t = tier ?? 0;
  return t >= 5 ? 5 : t === 4 ? 4 : t === 3 ? 3 : t === 2 ? 2 : 0;
}

/** The package name shown on a section divider. */
export function tierLabel(tier: number | null | undefined): string {
  const g = tierGroup(tier);
  return g === 5 ? "Enterprise" : g === 4 ? "Platinum" : g === 3 ? "Gold" : g === 2 ? "Silver" : "Free listings";
}

/**
 * The default order of the page: package tier (Enterprise, Platinum, Gold, Silver, then free / no plan), inside a tier the best
 * rated first, then the newest. The id is the last tie-breaker, so two pages of the list never repeat or skip a business.
 */
export function compareTop(a: TopOrderable, b: TopOrderable): number {
  return (
    tierGroup(b.plan_tier_order) - tierGroup(a.plan_tier_order) ||
    (b.avgRating ?? 0) - (a.avgRating ?? 0) ||
    (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Does `text` contain the search text at the START of a word? Case-insensitive, and the search text may be only the beginning of the
 * word ("ceme" finds "Cement", "Cements"), but it is never found in the middle of one: "cement" does not find "replacement",
 * "enhancements" or "reinforcement". Letters from any script count (Gujarati, Hindi); a word ends at a space or a mark like , . - /.
 */
export function matchesTerm(text: string | null | undefined, term: string): boolean {
  const t = term.replace(/\s+/g, " ").trim();
  if (!text || !t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}\\p{M}])${escaped}`, "iu");
  return re.test(text);
}

/** "Dahegam" / "Building Materials": what a search text matched besides the name (shown as "In: ..." under the name). */
export function matchedIn(term: string, city: string | null | undefined, category: { name: string; slug: string } | null | undefined): string[] {
  const t = term.trim();
  if (!t) return [];
  const out: string[] = [];
  if (city && matchesTerm(city, t)) out.push(city.replace(/\s+/g, " ").trim());
  if (category && matchesTerm(category.name, t)) out.push(category.name);
  return out;
}

/** The first few distinct names (case-insensitive), in the order given. */
export function pickHasNames(names: readonly string[], max = 2): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.replace(/\s+/g, " ").trim();
    const key = n.toLowerCase();
    if (!n || seen.has(key)) continue;
    seen.add(key);
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

export type NamedItem = { business_id: string; name: string | null };
export type ShowSwitches = { id: string; show_products?: boolean | null; show_services?: boolean | null };

/**
 * Which product / service matches may be used: only those of a business whose "Show Products / Services on my profile" switch is
 * ON (a business that switched it OFF is not found, and not named, through them). `switches` = null means the columns do not exist
 * yet (section-toggles SQL not applied): everything counts, exactly like the business page. Returns the names per business
 * (for the "Has: ..." line) and the ids of the businesses that matched through a visible item.
 */
export function visibleMatches(
  products: readonly NamedItem[],
  services: readonly NamedItem[],
  switches: readonly ShowSwitches[] | null,
): { has: Map<string, string[]>; ids: string[] } {
  const hiddenProducts = new Set<string>();
  const hiddenServices = new Set<string>();
  for (const r of switches ?? []) {
    if (r.show_products === false) hiddenProducts.add(r.id);
    if (r.show_services === false) hiddenServices.add(r.id);
  }
  const has = new Map<string, string[]>();
  const add = (id: string, name: string) => has.set(id, [...(has.get(id) ?? []), name]);
  for (const r of products) if (r.name?.trim() && !hiddenProducts.has(r.business_id)) add(r.business_id, r.name);
  for (const r of services) if (r.name?.trim() && !hiddenServices.has(r.business_id)) add(r.business_id, r.name);
  return { has, ids: [...has.keys()] };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The line above the list: `“plywood” – 12 businesses in 4 cities`, or `12 businesses in 4 cities` without a search text.
 * With one city chosen: `“plywood” – 5 businesses in Bhuj`.
 */
export function resultSummary(o: { q?: string; total: number; cityCount: number; cityName?: string | null }): string {
  const what = `${o.total} ${plural(o.total, "business", "businesses")}`;
  const where = o.cityName ? `in ${o.cityName}` : `in ${o.cityCount} ${plural(o.cityCount, "city", "cities")}`;
  const term = o.q?.trim();
  return term ? `“${term}” – ${what} ${where}` : `${what} ${where}`;
}
