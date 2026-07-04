Building all four enhancements in one pass. Here's the approach:

## 1. Google Maps integration

- Connect the Google Maps Platform connector (I'll prompt this when we start — you'll authorize it in one click).
- On business detail: replace the placeholder with an interactive Google Map centered on the business's lat/lng, with a marker.
- On the business create/edit form: add a "Find on map" address geocode button that fills lat/lng via the Geocoding API (called through the connector gateway in a server function so the key stays server-side).
- Fallback: if lat/lng is missing, show a static "Location not set" state instead of a broken map.

## 2. Business photo uploads

- Create a public `business-photos` storage bucket.
- RLS on `storage.objects`: public read; owners (or admins) can insert/update/delete photos only under their own `business_id/*` path.
- New `PhotoUploader` component on the edit page: multi-file upload, previews, delete, drag-to-reorder for `display_order`.
- Featured image: pick one uploaded photo as the business's `featured_image`.

## 3. Social/OTP login

- Enable **Apple** sign-in alongside the existing Google + email. Add an "Continue with Apple" button in `AuthForms` using `lovable.auth.signInWithOAuth("apple", ...)`.
- Skipping SMS OTP for now — it requires a paid Twilio/GatewayAPI connector and per-message costs. Happy to add it in a follow-up if you want; just say the word.

## 4. Branding & logo

- Generate a custom "NearMe" wordmark + icon logo (warm amber/orange palette, matching the current design tokens).
- Refine the header: use the real logo, tighten spacing, add a subtle gradient accent.
- Polish the home hero (bigger search, category chips row), and add a proper footer with links + socials.
- Set a real app title/description + og:image (using the generated logo) in `__root.tsx` and leaf routes.

## Order of execution

1. Generate logo assets + apply branding (no external deps — fastest win).
2. Storage bucket + photo uploads.
3. Apple sign-in (single-tool config + button).
4. Google Maps connector + map component + geocoding server fn.

I'll implement all four in sequence. Reply "go" (or with edits) and I'll start.