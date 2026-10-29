// Text and structured data for the city / category / city x category landing pages and the business pages.
// Everything here is a pure function of the data (no database, no browser): the same facts always give the same words, so the
// server-rendered page, its <head> and the JSON-LD always agree, and the wording can be tested on its own.
import { BASE_URL, SITE_NAME, breadcrumbLd, faqLd, itemListLd, ldScript, type Crumb } from "./seo";

// ---------------------------------------------------------------- slugs

/** "Vadagam (Aravalli)" -> "vadagam-aravalli". The ONE place a city name becomes an address part (pages, links, sitemap). */
export const citySlug = (city: string): string =>
  String(city)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const cityPath = (city: string) => `/city/${citySlug(city)}`;
export const comboPath = (city: string, categorySlug: string) => `/city/${citySlug(city)}/category/${categorySlug}`;

/** "himatnagar" -> "Himatnagar", for an address part that no business uses (such a page is noindex). */
export const prettySlug = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

/** The display name of a city that is stored in several spellings ("HIMATNAGAR", "Himatnagar"): the most used, not all capitals. */
export function pickCityName(variants: Array<{ name: string; count: number }>): string {
  const sorted = [...variants].sort((a, b) => {
    const capsA = a.name === a.name.toUpperCase() && /[A-Z]/.test(a.name) ? 1 : 0;
    const capsB = b.name === b.name.toUpperCase() && /[A-Z]/.test(b.name) ? 1 : 0;
    return capsA - capsB || b.count - a.count || a.name.localeCompare(b.name);
  });
  const best = sorted[0]?.name ?? "";
  // Only capitals everywhere: show it as a normal name.
  return best === best.toUpperCase() && /[A-Z]{3,}/.test(best) ? best.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase()) : best;
}

// ---------------------------------------------------------------- keywords (admin: "dealers, suppliers, near me")

const MAX_KEYWORDS = 8;
const MAX_KEYWORD_LENGTH = 30;

/** "Dealers, suppliers ,shop\nnear me" -> ["dealers", "suppliers", "shop", "near me"] (lower case, no duplicates, a sensible number). */
export function parseKeywords(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? "").split(/[,\n;]+/)) {
    const k = part.replace(/\s+/g, " ").trim().toLowerCase();
    if (!k || k.length > MAX_KEYWORD_LENGTH || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

const NEAR_ME = /\b(near me|nearby|near you)\b/;
const wordsOf = (keywords: string[]) => keywords.filter((k) => !NEAR_ME.test(k));
const hasNearMe = (keywords: string[]) => keywords.some((k) => NEAR_ME.test(k));
const titleCase = (s: string) => s.replace(/(^|[\s&-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
const lower = (s: string) => s.trim().toLowerCase();

/** "dealers, suppliers and wholesalers" for up to `max` keywords. */
function sayList(items: string[], max = 3): string {
  const list = items.slice(0, max);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

// ---------------------------------------------------------------- facts from the listed businesses

export type LandingBusiness = {
  name: string;
  address?: string | null;
  city?: string | null;
  verified?: boolean | null;
  avgRating?: number | null;
  reviewCount?: number | null;
};

export type RatedPick = { name: string; rating: number; reviews: number };

export type LandingFacts = {
  /** Exact number of published businesses on the page (may be more than the ones listed). */
  count: number;
  verified: number;
  /** The first three, in the order of the list (plan priority first). */
  names: string[];
  /** Best rated (4.0 and above, at least one review), best first, up to three. */
  rated: RatedPick[];
  /** Places named in the addresses of at least two businesses ("Sahakari Jin", "Station Road"). */
  areas: string[];
};

const NOT_AN_AREA = /^(india|gujarat|rajasthan|maharashtra|kutch|kachchh|gj|raj|dist\.?|district|taluka|tal\.?)$/i;

/** Parts of the addresses that at least two businesses share (so it is a real place, not one shop's house number). */
export function commonAreas(addresses: Array<string | null | undefined>, city?: string | null, max = 3): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const address of addresses) {
    if (!address) continue;
    const seenHere = new Set<string>();
    for (const raw of address.split(",")) {
      const part = raw.replace(/\s+/g, " ").trim();
      const key = part.toLowerCase();
      if (part.length < 4 || part.length > 32 || /\d/.test(part) || NOT_AN_AREA.test(part) || seenHere.has(key)) continue;
      if (city && (key === city.toLowerCase() || key.includes(city.toLowerCase()))) continue;
      seenHere.add(key);
      const cur = counts.get(key) ?? { label: part, n: 0 };
      cur.n += 1;
      counts.set(key, cur);
    }
  }
  return [...counts.values()]
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, max)
    .map((x) => x.label);
}

export function landingFacts(businesses: LandingBusiness[], total?: number, city?: string | null): LandingFacts {
  const rated = businesses
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => (b.reviewCount ?? 0) > 0 && (b.avgRating ?? 0) >= 4)
    .sort((x, y) => (y.b.avgRating ?? 0) - (x.b.avgRating ?? 0) || (y.b.reviewCount ?? 0) - (x.b.reviewCount ?? 0) || x.i - y.i)
    .slice(0, 3)
    .map(({ b }) => ({ name: b.name, rating: b.avgRating ?? 0, reviews: b.reviewCount ?? 0 }));
  return {
    count: total ?? businesses.length,
    verified: businesses.filter((b) => b.verified).length,
    names: businesses.slice(0, 3).map((b) => b.name),
    rated,
    areas: commonAreas(businesses.map((b) => b.address), city),
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const rating1 = (n: number) => n.toFixed(1);

function ratedSentence(rated: RatedPick[]): string {
  const bits = rated.map((r) => `${r.name} (${rating1(r.rating)}★, ${r.reviews} ${plural(r.reviews, "review", "reviews")})`);
  return `Top-rated picks include ${sayList(bits)}.`;
}

// ---------------------------------------------------------------- titles (about 60 characters, never cut in the middle of a word)

/** The first candidate that fits `max` characters; if none does, the shortest. */
export function fitTitle(candidates: string[], max = 60): string {
  return candidates.find((c) => c.length <= max) ?? [...candidates].sort((a, b) => a.length - b.length)[0];
}

/** "SHIV SAKTI TRADING CO.." -> "SHIV SAKTI TRADING CO." (a business name that ends with a full stop, followed by the sentence's own). */
const tidy = (s: string) => s.replace(/\.{2,}(?=\s|$)/g, ".").replace(/\s+/g, " ").trim();

export type LandingCopy = {
  title: string;
  description: string;
  /** Short paragraphs for the top of the page. */
  intro: string[];
  faq: Array<{ q: string; a: string }>;
};

const tidyCopy = (c: LandingCopy): LandingCopy => ({ ...c, intro: c.intro.map(tidy), faq: c.faq.map((x) => ({ q: tidy(x.q), a: tidy(x.a) })) });

/** Meta description of at most `max` characters: the names are dropped one by one (last first) until it fits. */
function fitDescription(build: (names: string[]) => string, names: string[], max = 160): string {
  for (let n = names.length; n >= 0; n--) {
    const d = tidy(build(names.slice(0, n)));
    if (d.length <= max) return d;
  }
  return tidy(build([]));
}

const CTA = `Call / WhatsApp directly on ${SITE_NAME}.`;

// ---------------------------------------------------------------- city x category: "Top Building Materials in Himatnagar"

export function comboCopy(o: { category: string; city: string; facts: LandingFacts; keywords: string[] }): LandingCopy {
  const { category: cat, city, facts, keywords } = o;
  const lc = lower(cat);
  const words = wordsOf(keywords);
  const nouns = words.slice(0, 2).map(titleCase);
  const n = facts.count;
  const head = `Top ${cat} in ${city}`;

  // The wished form is "Top <Category> in <City> – <N> <Nouns> | Kutchi Hub". When that is longer than 60 characters the brand is dropped
  // first (the words people search for matter more), then the second noun, and only then the nouns themselves.
  const title = fitTitle([
    ...(nouns.length === 2 && n > 1 ? [`${head} – ${n} ${nouns.join(" & ")} | ${SITE_NAME}`, `${head} – ${n} ${nouns.join(" & ")}`] : []),
    ...(nouns.length >= 1 && n > 1 ? [`${head} – ${n} ${nouns[0]} | ${SITE_NAME}`, `${head} – ${n} ${nouns[0]}`] : []),
    `${head} – ${n} ${plural(n, "Listing", "Listings")} | ${SITE_NAME}`,
    `${head} – ${n} ${plural(n, "Listing", "Listings")}`,
    `${head} | ${SITE_NAME}`,
    head,
  ]);

  const description = fitDescription(
    (names) => `${n} ${lc} in ${city}${names.length ? `: ${sayList(names)}` : ""}. ${CTA}`,
    facts.names,
  );

  const intro: string[] = [];
  intro.push(
    `${SITE_NAME} lists ${n} ${plural(n, "business", "businesses")} under ${cat} in ${city}${facts.verified > 0 ? `, ${facts.verified} of them verified` : ""}.` +
      (facts.rated.length ? ` ${ratedSentence(facts.rated)}` : facts.names.length ? ` Listed first: ${sayList(facts.names)}.` : "") +
      (facts.areas.length ? ` Listings are spread around ${sayList(facts.areas)}.` : ""),
  );
  intro.push(
    words.length
      ? `Whether you are looking for ${sayList(words)}, compare ratings, opening hours and photos, then call or WhatsApp the business directly.`
      : `Compare ratings, opening hours and photos, then call or WhatsApp the business directly.`,
  );

  const faq: LandingCopy["faq"] = [
    {
      q: `How many ${lc} are listed in ${city}?`,
      a: `${SITE_NAME} currently lists ${n} ${lc} in ${city}${facts.verified > 0 ? `, and ${facts.verified} of them ${plural(facts.verified, "is", "are")} verified` : ""}.`,
    },
    {
      q: `Which are the top-rated ${lc} in ${city}?`,
      a: facts.rated.length
        ? `${ratedSentence(facts.rated).replace("Top-rated picks include", "The best rated right now are")} Ratings come from customer reviews on each listing.`
        : facts.names.length
          ? `${sayList(facts.names)} ${plural(facts.names.length, "is", "are")} listed first. Ratings appear on each listing as customers review it.`
          : `Ratings appear on each listing as customers review it.`,
    },
    {
      q: `How can I contact ${lc} in ${city}?`,
      a: `Open a listing and tap Call or WhatsApp to reach the business directly. Each listing also shows the address and opening hours.`,
    },
    hasNearMe(keywords)
      ? {
          q: `Where can I find ${lc} near me in ${city}?`,
          a: `Open the filter and sort page and choose "Nearest" to see the ${lc} closest to you in and around ${city}.`,
        }
      : {
          q: `Can I filter ${lc} in ${city} by rating or opening hours?`,
          a: `Yes. On the filter and sort page you can show only verified, 4+ rated or open-now ${lc} in ${city}.`,
        },
  ];
  return tidyCopy({ title, description, intro, faq });
}

// ---------------------------------------------------------------- category in all cities: "Top Building Materials"

export type CityLink = { name: string; slug: string; count: number };
export type CategoryLink = { name: string; slug: string; count: number };

export function categoryCopy(o: { category: string; facts: LandingFacts; cities: CityLink[]; keywords: string[] }): LandingCopy {
  const { category: cat, facts, cities, keywords } = o;
  const lc = lower(cat);
  const words = wordsOf(keywords);
  const n = facts.count;
  const c = cities.length;
  const topCities = cities.slice(0, 3).map((x) => x.name);
  const head = `Top ${cat}`;

  const title = fitTitle([
    ...(c > 1 ? [`${head} – ${n} Listings in ${c} Cities | ${SITE_NAME}`, `${head} – ${n} Listings in ${c} Cities`] : []),
    `${head} – ${n} ${plural(n, "Listing", "Listings")} | ${SITE_NAME}`,
    `${head} – ${n} ${plural(n, "Listing", "Listings")}`,
    `${head} | ${SITE_NAME}`,
    head,
  ]);

  const description = fitDescription(
    (names) =>
      `${n} ${lc}${c > 1 ? ` across ${c} cities` : ""}${names.length ? `, mostly in ${sayList(names)}` : ""}. ${CTA}`,
    topCities,
  );

  const intro = [
    `${SITE_NAME} lists ${n} ${plural(n, "business", "businesses")} under ${cat}${c > 0 ? ` in ${c} ${plural(c, "city", "cities")}` : ""}${topCities.length ? `, most of them in ${sayList(topCities)}` : ""}.` +
      (facts.rated.length ? ` ${ratedSentence(facts.rated)}` : ""),
    words.length
      ? `Looking for ${sayList(words)}? Pick your city below, compare ratings and opening hours, then call or WhatsApp the business directly.`
      : `Pick your city below, compare ratings and opening hours, then call or WhatsApp the business directly.`,
  ];

  const faq: LandingCopy["faq"] = [
    { q: `How many ${lc} are listed on ${SITE_NAME}?`, a: `${SITE_NAME} currently lists ${n} ${lc}${c > 0 ? ` in ${c} ${plural(c, "city", "cities")}` : ""}${facts.verified > 0 ? `, and ${facts.verified} of the listed ones ${plural(facts.verified, "is", "are")} verified` : ""}.` },
    {
      q: `In which cities can I find ${lc}?`,
      a: topCities.length ? `Most ${lc} are listed in ${sayList(topCities)}. Choose a city on this page to see only the ${lc} there.` : `Choose a city on this page to see the ${lc} there.`,
    },
    { q: `How can I contact ${lc}?`, a: `Open a listing and tap Call or WhatsApp to reach the business directly.` },
    hasNearMe(keywords)
      ? { q: `How do I find ${lc} near me?`, a: `Open the filter and sort page and choose "Nearest" to see the ${lc} closest to you.` }
      : { q: `Can I filter ${lc} by rating?`, a: `Yes. On the filter and sort page you can show only verified, 4+ rated or open-now ${lc}.` },
  ];
  return tidyCopy({ title, description, intro, faq });
}

// ---------------------------------------------------------------- city, all categories: "Top Businesses in Himatnagar"

export function cityCopy(o: { city: string; facts: LandingFacts; categories: CategoryLink[] }): LandingCopy {
  const { city, facts, categories } = o;
  const n = facts.count;
  const k = categories.length;
  const top = categories.slice(0, 3).map((x) => x.name);
  const head = `Top Businesses in ${city}`;

  const title = fitTitle([
    `${head} – ${n} ${plural(n, "Listing", "Listings")} | ${SITE_NAME}`,
    `${head} | ${SITE_NAME}`,
    head,
  ]);

  const description = fitDescription(
    (names) => `${n} ${plural(n, "business", "businesses")} in ${city}${k > 1 ? `, across ${k} categories` : ""}${names.length ? ` such as ${sayList(names)}` : ""}. ${CTA}`,
    top,
  );

  const intro = [
    `${SITE_NAME} lists ${n} ${plural(n, "business", "businesses")} in ${city}${k > 0 ? ` across ${k} ${plural(k, "category", "categories")}` : ""}${top.length ? `, including ${sayList(top)}` : ""}.` +
      (facts.rated.length ? ` ${ratedSentence(facts.rated)}` : ""),
    `Choose a category below to compare ratings, opening hours and photos, then call or WhatsApp the business directly.`,
  ];

  const faq: LandingCopy["faq"] = [
    { q: `How many businesses are listed in ${city}?`, a: `${SITE_NAME} currently lists ${n} ${plural(n, "business", "businesses")} in ${city}${k > 0 ? ` across ${k} ${plural(k, "category", "categories")}` : ""}${facts.verified > 0 ? `, ${facts.verified} of the listed ones verified` : ""}.` },
    { q: `Which categories are available in ${city}?`, a: top.length ? `${sayList(top)}${k > top.length ? ` and ${k - top.length} more` : ""}. Choose a category on this page to see only those businesses.` : `Choose a category on this page to see those businesses.` },
    { q: `How can I contact a business in ${city}?`, a: `Open a listing and tap Call or WhatsApp to reach the business directly. Each listing also shows the address and opening hours.` },
  ];
  return tidyCopy({ title, description, intro, faq });
}

// ---------------------------------------------------------------- <head> pieces shared by every landing page

type Meta = Record<string, string>;

/** Title, description, canonical-independent Open Graph and Twitter tags. `noindex` for a page with nothing on it. */
export function pageMeta(o: { title: string; description: string; url: string; noindex?: boolean; image?: string | null }): Meta[] {
  const meta: Meta[] = [
    { title: o.title },
    { name: "description", content: o.description },
    { property: "og:title", content: o.title },
    { property: "og:description", content: o.description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: o.url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_IN" },
    { name: "twitter:card", content: o.image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: o.title },
    { name: "twitter:description", content: o.description },
  ];
  if (o.image) {
    meta.push({ property: "og:image", content: o.image });
    meta.push({ name: "twitter:image", content: o.image });
  }
  if (o.noindex) meta.push({ name: "robots", content: "noindex,follow" });
  return meta;
}

export const landingUrl = (path: string) => `${BASE_URL}${path}`;

/**
 * The whole <head> of a landing page: title, description, Open Graph / Twitter, canonical, and the JSON-LD (BreadcrumbList,
 * ItemList of the listed businesses, FAQPage). A page with no business gets noindex and only the breadcrumb.
 */
export function landingHead(o: { copy: LandingCopy; path: string; empty: boolean; crumbs: Crumb[]; items: Array<{ name: string; url: string }> }) {
  const url = landingUrl(o.path);
  return {
    meta: pageMeta({ title: o.copy.title, description: o.copy.description, url, noindex: o.empty }),
    links: [{ rel: "canonical", href: url }],
    scripts: [
      ldScript(breadcrumbLd(o.crumbs)),
      ...(o.empty ? [] : [ldScript(itemListLd(o.items.slice(0, 20))), ldScript(faqLd(o.copy.faq))]),
    ],
  };
}

// ---------------------------------------------------------------- business page

/** "9:00 AM", "9am", "21:00", "9" -> minutes after midnight; null when it is not a time. */
function toMinutes(raw: string): number | null {
  const m = raw.trim().toLowerCase().replace(/\s+/g, "").match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === "am" && h === 12) h = 0;
  if (m[3] === "pm" && h !== 12) h += 12;
  return h > 23 || min > 59 ? null : h * 60 + min;
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

const DAYS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/**
 * Opening hours as schema.org OpeningHoursSpecification: "9:00 AM - 1:00 PM, 3:00 PM - 8:00 PM" gives two entries, "Closed" none,
 * "24 hours" is 00:00-23:59, an overnight shift ends the next morning. Times are 24-hour HH:MM.
 */
export function openingHoursSpecs(hours: unknown): Array<{ "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string; closes: string }> {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return [];
  const out: Array<{ "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string; closes: string }> = [];
  for (const [key, value] of Object.entries(hours as Record<string, unknown>)) {
    const day = DAYS[key.toLowerCase().slice(0, 3)];
    const text = typeof value === "string" ? value.trim() : "";
    if (!day || !text || /^closed$/i.test(text)) continue;
    if (/^(24\s*hours?|24\/7|open\s*24)/i.test(text)) {
      out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens: "00:00", closes: "23:59" });
      continue;
    }
    for (const shift of text.split(",")) {
      const parts = shift.split(/\s*(?:-|–|—|\bto\b)\s*/i).filter(Boolean);
      if (parts.length !== 2) continue;
      const a = toMinutes(parts[0]);
      const b = toMinutes(parts[1]);
      if (a === null || b === null) continue;
      out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens: hhmm(a), closes: hhmm(b) });
    }
  }
  return out;
}

/** "Prayag Enterprise – Building Materials in Himatnagar | Kutchi Hub" */
export function businessTitle(name: string, category: string | null | undefined, city: string | null | undefined): string {
  const cat = category?.trim();
  const c = city?.trim();
  if (cat && c) return `${name} – ${cat} in ${c} | ${SITE_NAME}`;
  if (cat) return `${name} – ${cat} | ${SITE_NAME}`;
  if (c) return `${name} in ${c} | ${SITE_NAME}`;
  return `${name} | ${SITE_NAME}`;
}
