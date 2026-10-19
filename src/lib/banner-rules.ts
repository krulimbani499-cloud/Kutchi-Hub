// Which homepage banners a visitor sees, and in what order. Pure functions (no database), so the rules are easy to test.
//
//   Top slot    : banners of the visitor's own city whose placement is "home_top".
//   Middle slot : banners of the visitor's own city whose placement is "home_middle", THEN the "show in all cities"
//                 banners of other cities (Enterprise businesses with an active plan), whatever placement they were
//                 given in their own city. Local ones first; inside each group best priority first.
//   All locations: every active banner in its own placement, no cap.

export type BannerPlacement = "home_top" | "home_middle";

export const BANNER_PLACEMENTS: readonly BannerPlacement[] = ["home_top", "home_middle"];

export const BANNER_PLACEMENT_LABEL: Record<BannerPlacement, string> = {
  home_top: "Top",
  home_middle: "Middle",
};

export type OrderableBanner = { priority: number; created_at?: string | null };

/** Highest priority first; among equals the newest first. Does not change the array it is given. */
export function sortBanners<T extends OrderableBanner>(banners: readonly T[]): T[] {
  return [...banners].sort(
    (a, b) => b.priority - a.priority || (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
}

/** Own-city banners first, then the all-city ones from other cities; `limit` caps the total (omit = no cap). */
export function composeHomeBanners<T extends OrderableBanner>(local: readonly T[], allCities: readonly T[], limit?: number): T[] {
  const merged = [...sortBanners(local), ...sortBanners(allCities)];
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
