// The map of the whole directory built from one list of published businesses: which cities and categories have businesses, how many,
// and when each page's content last changed. The landing pages, their internal links and the sitemap all read this one answer, so a
// page that is linked or listed always has at least one business, and every city uses one address part (see citySlug).
// Pure function (no database): it is given the rows.
import { citySlug, pickCityName, type CategoryLink, type CityLink } from "./seo-landing";

export type DirectoryRow = { slug: string; city: string | null; category_id: string | null; updated_at: string | null };
export type DirectoryCategory = { id: string; name: string; slug: string; seo_keywords?: string | null; updated_at?: string | null };

export type DirectoryCity = {
  slug: string;
  /** Display name (the most used spelling). */
  name: string;
  /** Every spelling stored in the businesses (to find them again). */
  variants: string[];
  count: number;
  lastmod: string | null;
  /** Its categories, most businesses first. */
  categories: CategoryLink[];
};

export type DirectoryCategoryEntry = {
  id: string;
  slug: string;
  name: string;
  keywords: string | null;
  count: number;
  lastmod: string | null;
  /** Its cities, most businesses first. */
  cities: CityLink[];
};

export type Directory = {
  cities: Map<string, DirectoryCity>;
  categories: Map<string, DirectoryCategoryEntry>;
  /** Every city x category pair with at least one business. */
  combos: Array<{ city: string; category: string; count: number; lastmod: string | null }>;
};

const later = (a: string | null, b: string | null | undefined) => (!b ? a : !a || b > a ? b : a);
const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : null);

export function buildDirectory(rows: DirectoryRow[], categories: DirectoryCategory[]): Directory {
  const catById = new Map(categories.map((c) => [c.id, c]));
  type CityBucket = { variants: Map<string, number>; count: number; lastmod: string | null; cats: Map<string, { count: number; lastmod: string | null }> };
  type CatBucket = { count: number; lastmod: string | null; cities: Map<string, number> };
  const cityBuckets = new Map<string, CityBucket>();
  const catBuckets = new Map<string, CatBucket>();

  for (const row of rows) {
    const slug = row.city ? citySlug(row.city) : "";
    const cat = row.category_id ? catById.get(row.category_id) : undefined;
    if (slug && row.city) {
      const cb = cityBuckets.get(slug) ?? { variants: new Map(), count: 0, lastmod: null, cats: new Map() };
      cb.variants.set(row.city, (cb.variants.get(row.city) ?? 0) + 1);
      cb.count += 1;
      cb.lastmod = later(cb.lastmod, row.updated_at);
      if (cat) {
        const cur = cb.cats.get(cat.slug) ?? { count: 0, lastmod: null };
        cur.count += 1;
        cur.lastmod = later(cur.lastmod, row.updated_at);
        cb.cats.set(cat.slug, cur);
      }
      cityBuckets.set(slug, cb);
    }
    if (cat) {
      const kb = catBuckets.get(cat.slug) ?? { count: 0, lastmod: null, cities: new Map() };
      kb.count += 1;
      kb.lastmod = later(kb.lastmod, row.updated_at);
      if (slug) kb.cities.set(slug, (kb.cities.get(slug) ?? 0) + 1);
      catBuckets.set(cat.slug, kb);
    }
  }

  const catBySlug = new Map(categories.map((c) => [c.slug, c]));
  const cities = new Map<string, DirectoryCity>();
  for (const [slug, cb] of cityBuckets) {
    const name = pickCityName([...cb.variants].map(([n, count]) => ({ name: n, count })));
    cities.set(slug, {
      slug,
      name,
      variants: [...cb.variants.keys()],
      count: cb.count,
      lastmod: day(cb.lastmod),
      categories: [...cb.cats]
        .map(([cslug, v]) => ({ name: catBySlug.get(cslug)?.name ?? cslug, slug: cslug, count: v.count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    });
  }

  const cats = new Map<string, DirectoryCategoryEntry>();
  for (const [slug, kb] of catBuckets) {
    const c = catBySlug.get(slug)!;
    cats.set(slug, {
      id: c.id,
      slug,
      name: c.name,
      keywords: c.seo_keywords ?? null,
      count: kb.count,
      lastmod: day(kb.lastmod),
      cities: [...kb.cities]
        .map(([cslug, count]) => ({ name: cities.get(cslug)?.name ?? cslug, slug: cslug, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    });
  }

  const combos: Directory["combos"] = [];
  for (const [cslug, cb] of cityBuckets) {
    for (const [kslug, v] of cb.cats) combos.push({ city: cslug, category: kslug, count: v.count, lastmod: day(v.lastmod) });
  }
  combos.sort((a, b) => a.city.localeCompare(b.city) || a.category.localeCompare(b.category));
  return { cities, categories: cats, combos };
}
