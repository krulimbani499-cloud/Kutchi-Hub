// Which homepage banners a visitor sees, and in what order. Pure functions (no database), so the rules are easy to test.
//
//   Top slot    : banners of the visitor's own city whose placement is "home_top".
//   Middle slot : banners of the visitor's own city whose placement is "home_middle", AND the "show in all cities"
//                 banners of other cities (Enterprise businesses with an active plan), whatever placement they were
//                 given in their own city: one pool.
//   All locations: ONLY banners whose business has an ACTIVE Enterprise plan (the same check as "Show in all cities", whatever
//                 that box says), each in its own placement, no cap. None qualify = the slot is hidden.
//
//   ORDER (every slot, category banners too): fair rotation. Higher priority first; banners with the SAME priority (nearly all of them)
//   in random order, a new one each time. The date a banner was created never decides anything (see shuffleByPriority).

export type BannerPlacement = "home_top" | "home_middle";

export const BANNER_PLACEMENTS: readonly BannerPlacement[] = ["home_top", "home_middle"];

export const BANNER_PLACEMENT_LABEL: Record<BannerPlacement, string> = {
  home_top: "Top",
  home_middle: "Middle",
};

export type OrderableBanner = { priority: number; id?: string };

/** A small seeded random generator (mulberry32): the same seed always gives the same sequence of numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fair rotation order: the highest priority first, and banners with the SAME priority in random order (Fisher-Yates). The date a
 * banner was created is never looked at. Does not change the array it is given.
 * `rand` defaults to Math.random (a new order every call). With a seeded generator the result depends only on WHICH banners there
 * are and the seed, not on the order they arrive in (each group is put in id order before it is shuffled), so a page can keep one
 * order for the whole page view even if the same banners are fetched again in another order.
 */
export function shuffleByPriority<T extends OrderableBanner>(banners: readonly T[], rand: () => number = Math.random): T[] {
  const groups = new Map<number, T[]>();
  for (const b of banners) {
    const group = groups.get(b.priority);
    if (group) group.push(b);
    else groups.set(b.priority, [b]);
  }
  const out: T[] = [];
  for (const priority of [...groups.keys()].sort((a, b) => b - a)) {
    const group = groups.get(priority)!.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    out.push(...group);
  }
  return out;
}

/** The own-city banners and the "show in all cities" ones of other cities as ONE pool in fair rotation order; `limit` caps the total after the shuffle (omit = no cap). */
export function composeHomeBanners<T extends OrderableBanner>(local: readonly T[], allCities: readonly T[], limit?: number): T[] {
  const merged = shuffleByPriority([...local, ...allCities]);
  return limit === undefined ? merged : merged.slice(0, limit);
}

/** Same city, ignoring upper/lower case and surrounding spaces (the same rule the database query uses). */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

export type BannerCountRow = {
  active: boolean;
  city: string;
  placement?: string | null;
  start_at?: string | null;
  end_at?: string | null;
};

/** Is this banner showing right now (switched on, started, not ended)? */
export function isBannerLive(b: Pick<BannerCountRow, "active" | "start_at" | "end_at">, now = Date.now()): boolean {
  if (!b.active) return false;
  if (b.start_at && new Date(b.start_at).getTime() > now) return false;
  if (b.end_at && new Date(b.end_at).getTime() <= now) return false;
  return true;
}

/** Banners that are live now, counted per city (case-insensitive) and placement. Too many in one slot is a problem (> 5). */
export const BANNER_SLOT_WARNING_ABOVE = 5;

export function countLiveBannersBySlot(banners: readonly BannerCountRow[], now = Date.now()) {
  const map = new Map<string, { city: string; placement: BannerPlacement; count: number }>();
  for (const b of banners) {
    if (!isBannerLive(b, now)) continue;
    const placement: BannerPlacement = b.placement === "home_middle" ? "home_middle" : "home_top";
    const key = `${b.city.trim().toLowerCase()}|${placement}`;
    const row = map.get(key) ?? { city: b.city.trim(), placement, count: 0 };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, key: `${r.city.toLowerCase()}|${r.placement}`, tooMany: r.count > BANNER_SLOT_WARNING_ABOVE }))
    .sort((a, b) => a.city.localeCompare(b.city) || a.placement.localeCompare(b.placement));
}

/**
 * Does this banner show in "All locations"? Only a homepage banner (no category) that is live right now and whose business has an
 * ACTIVE Enterprise plan. The "Show in all cities" box does not matter. `enterpriseBusinessIds` comes from the same plan check the
 * visitor query uses (activeEnterpriseBusinessIds). Used for the badge in the admin banner list.
 */
export function showsInAllLocations(
  b: { category_id?: string | null; business_id?: string | null; active: boolean; start_at?: string | null; end_at?: string | null },
  enterpriseBusinessIds: ReadonlySet<string>,
  now = Date.now(),
): boolean {
  return !b.category_id && !!b.business_id && enterpriseBusinessIds.has(b.business_id) && isBannerLive(b, now);
}
