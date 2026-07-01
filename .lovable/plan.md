## Product scope

Build a public business listing app (Justdial-style) where visitors can search/browse businesses by category, view profiles, read/write reviews, and where signed-in users can add/manage their own business listings and claim existing ones.

## Database (migration)

1. **Profiles & roles**
   - `profiles` table: `user_id` FK to auth.users, display name, avatar url, phone, auto-created on signup via trigger.
   - `user_roles` table + `app_role` enum (`user`, `business_owner`, `admin`).
   - `has_role` security definer helper.

2. **Categories**
   - `categories`: name, slug, icon, color, parent_id, display_order.

3. **Businesses**
   - `businesses`: name, slug, category_id, description, address/city/state/pincode, phone, email, website, lat/lng, owner_id, status, verified, hours JSON, featured_image, created/updated timestamps.
   - Slug unique per city.

4. **Reviews & photos**
   - `business_reviews`: business_id, user_id, rating, review, helpful_count.
   - `business_photos`: business_id, url, caption, display_order.

5. **Claims**
   - `business_claims`: business_id, user_id, status, message.

6. **RLS**
   - Public read access to categories and published/verified businesses.
   - Authenticated users can create businesses/reviews/claims; owners can update their own businesses; admins can manage everything.

## Design system

Justdial-style: dense, colorful, category-first.
- Warm primary palette (amber/orange accents) on a clean light background.
- Prominent search bar at the top, category chips below.
- Business cards with large tap targets, visible phone/address/rating, and quick action buttons (Call, Enquire, Directions, Review).
- Use semantic tokens in `src/styles.css`; add tokens for category colors, map pin, and rating stars.

## Routes

- `/` — Home: hero search, popular categories nearby, featured listings.
- `/search` — Search results with filters (category, city, rating, sort).
- `/business/$slug` — Business detail: header image, info, hours, reviews, map placeholder, action bar.
- `/categories` — All categories grid.
- `/auth` — Sign in / sign up (email + Google), with password reset.
- `/reset-password` — Set new password after recovery link.
- `/_authenticated/dashboard` — My listings (business owner/admin) and claim requests.
- `/_authenticated/business/new` — Add a new business.
- `/_authenticated/business/$slug/edit` — Edit own business.
- `/_authenticated/business/$slug/claim` — Submit a claim to manage an existing business.
- `/sitemap.xml` + `robots.txt` — standard setup.

## Server functions

- `searchBusinesses` — public, full-text search over name/description/city/category.
- `getBusinessBySlug` — public detail + aggregated rating + reviews + photos.
- `getCategories` — public category list.
- `getHomeData` — public featured categories + businesses.
- `createBusiness` — authenticated, creates business and sets owner role.
- `updateBusiness` — authenticated, owner/admin only.
- `addReview` — authenticated.
- `submitClaim` — authenticated.
- `getDashboard` — authenticated, owner/admin listings + claims.
- `updateClaimStatus` — admin only.

## Components

- `Header` — logo, search bar, location, auth buttons.
- `CategoryGrid` — color-coded category cards.
- `BusinessCard` — compact Justdial-style card with rating, address, phone, action buttons.
- `SearchFilters` — category, city, rating, sort.
- `BusinessDetail` — hero, info, hours, reviews form/list, map placeholder.
- `AuthForms` — sign-in, sign-up, Google button, password reset.
- `DashboardShell` — sidebar for owner/admin actions.
- `BusinessForm` — add/edit form with category select and address fields.

## Auth wiring

- Use the generated Lovable Cloud auth (`lovable.auth.signInWithOAuth` for Google, `supabase.auth.signInWithPassword` / `signUp` for email).
- Add `src/routes/_authenticated/route.tsx` with `ssr: false` and `beforeLoad` redirect to `/auth`.
- Single `onAuthStateChange` subscriber in `__root.tsx` for cache invalidation.

## Open items

1. Map integration: use a static Google Maps image or an embedded map iframe? The Google Maps connector requires setup; by default use a static placeholder map image from the generated images. Ask user before enabling the Google Maps connector.
2. Business images: generate placeholder category/hero images. Owners can upload photos later via a storage bucket (enable if needed).
3. Search: start with simple ILIKE + category filters; add full-text index if search volume grows.
