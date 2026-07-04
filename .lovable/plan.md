## Goal

Aapke ZIP wale complete Kutchi Hub project ki features current Lovable project (jismein hum already NearMe → Kutchi Hub rebrand kar chuke hain) mein port karna. Poora ek shot mein karna risky hai — 8800+ lines aur 11 migrations hain — isliye 4 phases mein karenge. Har phase ke baad aap preview verify karke aage jaao.

## Difference snapshot

Current project already has: categories, businesses, reviews, claims, business photos, auth (email + Google + Apple), business detail with Google Maps, photo uploader, dashboard.

Missing (from ZIP): submission → admin approval flow, admin panel, marketing banners + carousel, advertise page, owner-editable "My Business" page, geolocation + city search + India cities list, mobile app shell (Capacitor), site footer.

## Phase 1 — Home page + city selector + footer + header split

Scope:
- Split `Header.tsx` into `TopRibbon` (city selector + login), `DesktopHeader`, `MobileHeader`, `SearchBar`, `UserMenu` (matching ZIP structure).
- Add `src/lib/cities.ts` (India cities list) and `src/lib/geolocation.ts` (browser geolocation + reverse geocode via existing Google Maps connector).
- Add `SiteFooter.tsx` with links/socials.
- Rebuild home (`index.tsx`) to match ZIP layout: hero + city detector, featured businesses row, category grid, "list your business" CTA.

No DB changes in this phase.

## Phase 2 — Business submission + admin approval flow

Scope:
- Migration: new tables `business_submissions` (pending user submissions), `admin_settings`; add `owner_id` column to `businesses`; RLS policies + GRANTs; helper policy so owners can see own hidden rows.
- Routes: `/list-business` (public submission form), `/admin` (admin-only, list + approve/reject), `/my-business` (owner edit).
- Server functions: `createSubmission`, `listPendingSubmissions` (admin), `approveSubmission`, `rejectSubmission`, `updateMyBusiness`.
- Header updates: signed-in user sees "My Business" / "Submission Pending" / "List Business" based on status.

## Phase 3 — Marketing banners + advertise page

Scope:
- Migration: `banners` table (image_url, link, position, active, sort_order) + admin-only write RLS + public read.
- Storage bucket `banner-images` (public).
- `MarketingBannerCarousel.tsx` component using embla-carousel (already installed).
- `BannerManager.tsx` in admin panel — upload, reorder, toggle active.
- `/advertise` public route explaining ad packages with a lead form.

## Phase 4 — Category pages polish + mobile app (Capacitor)

Scope:
- `/category/$slug` route with SEO metadata per category (currently only `/search?category=`).
- Optional (ask before doing): Capacitor Android shell — `capacitor.config.ts`, `android/` folder, build scripts. This adds a native mobile app wrapper.

## Technical details

- Stack stays TanStack Start + Supabase (as current). ZIP uses same stack.
- ZIP's schema is compatible with current one — will map their `reviews` → our existing `business_reviews`, add missing columns like `owner_id`, `whatsapp`, `pincode`, `hours` where absent.
- Admin gate uses existing `user_roles` table + `has_role('admin')` RPC (already in DB).
- All new tables get GRANTs + RLS in the same migration.
- OAuth stays same (Google + Apple already configured).
- Google Maps connector already linked — geolocation uses it via server fn.

## Confirm before starting

1. Kya **Phase 1 se shuru karu** (safe, no DB changes)?
2. Phase 4 mein **Capacitor / Android app shell** chahiye ya skip karu? (Mobile app builds Lovable preview ke bahar hote hain — repo download karke Android Studio mein compile karna padta hai.)
3. Koi phase priority change karna hai — jaise banners pehle chahiye?
