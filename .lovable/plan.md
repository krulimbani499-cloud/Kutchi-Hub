# Kutchi Hub — Complete SEO Plan

Goal: rank Kutchi Hub for local business discovery searches (category + city, business name, "near me") on Google and get rich results (stars, breadcrumbs, sitelinks) so users click through.

---

## 1. Foundations (site-wide, one-time)

- Canonical domain: `https://kutchi-hub.lovable.app` (or custom domain once connected). Add `<link rel="canonical">` on every route pointing to the clean URL (no query strings, no trailing slash).
- Force HTTPS + single host (no www vs non-www split).
- Update `src/routes/__root.tsx` head:
  - Replace generic title/description with a keyword-rich default only for pages that don't override.
  - Add `og:site_name`, `og:locale` (`en_IN`), fix `twitter:site` (must be `@handle`, not text).
  - Add JSON-LD `Organization` + `WebSite` with `SearchAction` (enables Google sitelinks searchbox).
- `public/robots.txt`: allow all, disallow `/auth`, `/_authenticated/*`, `/reset-password`; reference sitemap URL.
- Verify `sitemap.xml` route includes: home, categories index, every category, every city, every published business, static pages. Include `<lastmod>` from DB `updated_at`. Ping Google/Bing on publish.
- Register site in Google Search Console + Bing Webmaster Tools; submit sitemap.

## 2. Per-route metadata (unique title + description on every page)

Format rules: title <60 chars, description <160 chars, one H1 per page, keyword near the front.

| Route | Title pattern | H1 |
|---|---|---|
| `/` (home) | `Kutchi Hub — Find Local Businesses in {defaultCity}` | Find trusted local businesses |
| `/categories` | `All Business Categories — Kutchi Hub` | Browse categories |
| `/category/$slug` | `Best {Category} in {City} — Reviews & Contacts \| Kutchi Hub` | Best {Category} in {City} |
| `/city/$slug` | `Top Businesses in {City} — Kutchi Hub` | Businesses in {City} |
| `/business/$slug` | `{Business Name} — {Category} in {City} \| Kutchi Hub` | {Business Name} |
| `/search` | `noindex` (thin/duplicate) | — |
| `/list-your-business` | `List Your Business Free — Kutchi Hub` | List your business |
| `/auth`, `/_authenticated/*`, `/reset-password` | `noindex` | — |

Each route's `head()` sets `og:title`, `og:description`, `og:type` (`website` / `article` / `business.business`), `og:image` (hero image absolute URL — leaf only), `twitter:card=summary_large_image`, canonical link.

## 3. Structured data (JSON-LD)

Inject via route `head().scripts` on the matching page:

- Home: `Organization` + `WebSite` with `SearchAction` pointing to `/search?q={search_term_string}`.
- `/business/$slug`: `LocalBusiness` (or specific subtype — `Restaurant`, `MedicalBusiness`, `HealthAndBeautyBusiness` — chosen from category), with `name`, `image`, `address` (`PostalAddress`), `geo`, `telephone`, `url`, `openingHoursSpecification`, `priceRange`, `aggregateRating` (only if reviewCount > 0), and up to N `review` items with author + rating. Add `BreadcrumbList`.
- `/category/$slug` and `/city/$slug`: `CollectionPage` + `BreadcrumbList` + `ItemList` of the listings on the page.
- `/categories`: `BreadcrumbList` + `ItemList`.

## 4. URL & information architecture

- Keep slugs short, lowercase, hyphenated. Slug generated from name + city on create; enforce uniqueness (already in schema — verify).
- Add city+category combo pages later (`/{city}/{category}`) for long-tail "restaurants in bhuj" queries — highest local SEO ROI.
- Internal linking:
  - Business page → sibling businesses (RelatedBusinesses already exists), parent category, city.
  - Category page → other categories, top cities.
  - Breadcrumbs (visible + JSON-LD) on category, city, and business pages.
- Every internal navigation uses `<Link>` (crawlable `<a href>`), no JS-only handlers.

## 5. Content SEO

- Each category page: 60–120 word intro paragraph above the fold ("Looking for the best {category} in {city}? Browse verified listings, reviews, hours and contact details…"). Store in DB or a category-content map.
- Each city page: short intro + FAQ block ("How many {businesses} are listed in {city}?", "How to add my business?") marked up with `FAQPage` JSON-LD.
- Business page: ensure description ≥ 150 words is prompted at listing time; show services, hours, address, photos, reviews — Google needs unique content.
- Blog / guides (phase 2): `/guide/starting-a-business-in-{city}`, `/guide/best-{category}-in-{city}` — capture informational queries.

## 6. Images

- Every `<img>` gets descriptive `alt` (business name + category + city). Audit `BusinessCard`, `BusinessDetail`, `BusinessPhotoImage`.
- Serve responsive `srcset` from Supabase storage transformations; lazy-load below the fold (`loading="lazy"`, `decoding="async"`); explicit `width`/`height` to prevent CLS.
- Preload the LCP image on business detail routes.

## 7. Performance / Core Web Vitals

- Target LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Route-level code splitting is default in TanStack Start — verify with a prod build; keep heavy libs (maps, charts) dynamic-imported.
- `<link rel="preconnect">` to Supabase storage host in `__root.tsx`.
- Cache category/city listings (`staleTime` already set) — reduces TTFB on repeat views.
- Compress hero images to WebP/AVIF ≤ 150 KB.
- Remove unused fonts; `font-display: swap`.

## 8. Local SEO signals

- Add NAP (Name, Address, Phone) consistently on business page — must match `LocalBusiness` JSON-LD verbatim.
- Encourage owners to claim listings (claim flow already exists) — verified badge = trust signal.
- Prompt satisfied customers to leave reviews (post-visit email/notification) — review volume + freshness ranks local.
- Ensure `sameAs` in JSON-LD links out to the business's real socials when provided.

## 9. Off-page / discovery

- Submit sitemap to Google + Bing.
- Create Google Business Profile for Kutchi Hub itself.
- Share weekly featured-business posts on socials linking back with clean URLs.
- Reach out to Kutchi community forums / Facebook groups for backlinks.
- Add a public "Press / About" page — natural target for backlinks.

## 10. Monitoring

- Search Console: monitor coverage, Core Web Vitals, rich result reports (LocalBusiness, BreadcrumbList), top queries per page.
- Weekly check: pages indexed vs pages submitted; 404s; mobile usability errors.
- Track top 20 target queries (`{category} in {city}`) in a lightweight rank tracker.

---

## Technical details (implementation order)

1. **Metadata pass** — update `head()` on `__root.tsx`, `index.tsx`, `categories.tsx`, `category.$slug.tsx`, `city.$slug.tsx`, `business.$slug.tsx`, `list-your-business.tsx`. Add canonical link builder in `src/lib/seo.ts`.
2. **JSON-LD helpers** — `src/lib/seo/jsonld.ts` with `organizationLd()`, `websiteLd()`, `localBusinessLd(business, reviews)`, `breadcrumbLd(items)`, `itemListLd(items)`, `faqLd(qas)`. Inject via `head().scripts`.
3. **Robots + sitemap audit** — extend `sitemap[.]xml.ts` to include categories/cities/businesses with `lastmod`; update `public/robots.txt`.
4. **Noindex private routes** — `_authenticated/*`, `auth`, `reset-password`, `search` head adds `{ name: "robots", content: "noindex,follow" }`.
5. **Breadcrumb component** — visible breadcrumb on category/city/business pages, paired with `BreadcrumbList` JSON-LD.
6. **Image audit** — fix alts, add width/height, lazy-load, preconnect Supabase host.
7. **Content blocks** — intro paragraph per category/city page (DB column `seo_intro`), FAQ per city.
8. **Search Console setup** — verify domain, submit sitemap, monitor.

Phase 1 items 1–5 are the highest-impact and can ship first; 6–8 follow.
