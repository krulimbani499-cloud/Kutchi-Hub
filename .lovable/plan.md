# Kutchi Hub — Complete SEO Plan

Goal: Rank Kutchi Hub as the #1 local business directory for Kutch region (Bhuj, Gandhidham, Anjar, Mandvi, Mundra, Kapadvanj, etc.) on Google, and dominate long-tail "[category] in [city]" searches.

---

## Phase 1 — Technical SEO Foundation (Week 1)

Most items already exist; this phase closes gaps.

1. **Sitemap audit**
   - Already dynamic at `/sitemap.xml`. Add `lastmod` on category & city pages using latest business `updated_at` per bucket.
   - Split into `sitemap-businesses.xml`, `sitemap-cities.xml`, `sitemap-categories.xml` via a `<sitemapindex>` when businesses cross 500 URLs.

2. **robots.txt**
   - Keep current disallows. Add `Disallow: /search?` to avoid infinite parameter crawls, but `Allow: /search$` for the base page.

3. **Canonical & OG hygiene**
   - Audit every route file to confirm canonical + og:url self-reference (already good on business/city/categories). Add same pattern to `/search`, `/category/$slug`, `/city/$slug/category/$category`, `/events`, `/list-your-business`, `/pricing`.

4. **Structured data expansion**
   - Add `LocalBusiness` `openingHoursSpecification`, `priceRange`, `geo` (lat/lng) to business detail JSON-LD.
   - Add `Review` items (top 5) inside `LocalBusiness` schema.
   - Add `Event` schema on `/events` route.
   - Add `BreadcrumbList` on category & search pages.

5. **Performance / Core Web Vitals**
   - Homepage already lazy-loads below-the-fold. Add `<link rel="preload">` for hero font subset.
   - Convert business featured images to WebP + `srcset` (already using Supabase storage — add transform params).
   - Add `loading="lazy"` + `decoding="async"` to every BusinessCard image.

6. **Indexability**
   - Add `<meta name="robots" content="noindex,follow">` on `/search` result pages with query params, and on paginated pages beyond page 1.
   - Ensure 404s return proper status (TanStack `notFoundComponent` — verify SSR 404 response code).

7. **Internal linking**
   - Footer: link to top 8 cities + top 12 categories.
   - Business page: "More [category] in [city]" + "Nearby businesses" (already exists) — ensure crawlable `<a href>`.

---

## Phase 2 — On-Page SEO (Week 2)

1. **Title/description templates** (finalize):
   - Business: `{Name} — {Category} in {City}, Kutch | Kutchi Hub`
   - City: `Top {N} Businesses in {City}, Kutch — Reviews & Contacts | Kutchi Hub`
   - Category: `Best {Category} in Kutch — {N} Verified Listings | Kutchi Hub`
   - City+Category: `Best {Category} in {City} — Reviews, Phone, Address | Kutchi Hub`

2. **H1 hierarchy** — one H1 per page, matches primary keyword.

3. **Content blocks on category & city pages**
   - 150–250 word intro paragraph (unique per page) above the fold: "About {category/city}", why to choose, what to look for.
   - FAQ block (3–5 Q&As) at bottom — already added to city pages; extend to category & city+category.

4. **Image SEO**
   - Alt text template: `{Business name} — {category} in {city}`.
   - Auto-generate at upload time in `PhotoUploader`.

5. **URL structure** — already clean (`/business/slug`, `/city/slug`, `/category/slug`). Keep.

---

## Phase 3 — Keyword & Content Strategy (Weeks 3–4)

1. **Primary keyword clusters** (target):
   - `businesses in {city}` — Bhuj, Gandhidham, Anjar, Mandvi, Mundra, Kapadvanj, Nakhatrana, Rapar
   - `{category} in {city}` — restaurants, doctors, hospitals, salons, grocery, hotels, mechanics
   - `kutch business directory`, `kutchi hub`, `local businesses kutch`

2. **Semrush research pass** — I'll run `keyword_research` + `serp_analysis` on the top 20 seed phrases to validate volume/difficulty before we finalize.

3. **Blog / content hub** (new `/blog` route)
   - 2 posts/week starter set:
     - "Top 10 Restaurants in Bhuj (2026)"
     - "Best Doctors in Gandhidham — Complete Guide"
     - "Kutch Travel Guide: Where to Eat, Stay, Shop"
     - "How to Grow Your Local Business in Kutch"
   - Each post: 800–1500 words, internal links to relevant city/category pages, Article JSON-LD.

4. **Programmatic pages** — already exist for city+category; ensure at least one exists for every top city × top 15 categories combination.

---

## Phase 4 — Local SEO (Ongoing)

1. **Google Business Profile** for Kutchi Hub itself (registered address in Kutch).
2. Encourage listed businesses to add their own GBP and link back to Kutchi Hub page.
3. **NAP consistency** — enforce standard phone/address format in `BusinessForm`.
4. **Review generation** — post-visit prompt (email + WhatsApp) to leave reviews on the business's Kutchi Hub page.

---

## Phase 5 — Off-Page & Authority (Month 2+)

1. Submit sitemap to Google Search Console + Bing Webmaster Tools.
2. Directory citations: Justdial, Sulekha, IndiaMART, local Kutch chambers of commerce.
3. Guest posts on Gujarati news sites / Kutch community blogs.
4. Social signals: Instagram/Facebook/YouTube (accounts already reserved) — auto-share new listings.
5. PR: press release when hitting 500, 1000 listings.

---

## Phase 6 — Monitoring & Iteration (Continuous)

1. **Google Search Console** — verified already (`google-site-verification` present). Weekly review of impressions, CTR, top queries.
2. **Semrush tracking** — I'll run `domain_analysis` + `seo_trend` monthly to track keyword count & traffic.
3. **Rank tracking** — top 30 keywords across Bhuj/Gandhidham/Kapadvanj markets.
4. **A/B title tests** on top 20 traffic pages.
5. **404 & broken-link audit** monthly.

---

## Deliverables I'll Build in This Project

If you approve, I'll implement in this order:

1. Structured data expansion (LocalBusiness enrichment, Event schema, more breadcrumbs)
2. Image alt-text automation + lazy-loading pass
3. `/search` noindex logic + parameter handling
4. Unique intro copy + FAQ block on category & city+category pages
5. Blog route scaffolding (`/blog`, `/blog/$slug`) with Article schema
6. Footer internal-linking hub (top cities + categories)
7. Semrush keyword validation pass (I'll call the tools and share results)

## Out of Scope (needs you)

- GBP claim & verification
- Off-site citations & guest posts
- Social account content calendar
- Writing the actual blog articles (I can draft — you approve/edit)

---

Approve karo aur main Phase 1 se implementation shuru kar deta hu. Ya specific phase se start karna hai batao.
