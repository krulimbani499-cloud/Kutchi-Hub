## Phase 1: Pricing System (Display + Admin Setup only)

Payment gateway abhi skip — Phase 2 me Stripe/Razorpay add karenge. Abhi business owners "Upgrade" click karke WhatsApp/Call admin ko contact karenge, admin manually plan assign karega.

### 1. Database (1 migration)

**`plans` table** (admin-managed pricing tiers)
- name (Free/Silver/Gold/Platinum), slug, tier_order
- price_monthly, price_yearly (₹)
- description, features (JSON array of strings)
- color, icon, is_active, is_popular (highlight badge)
- Limits: max_photos, max_products, max_services, max_events
- Perks: featured_listing, verified_badge, top_ranking, unlimited_leads, priority_support, analytics_access, banner_ad_slots
- RLS: anon+authenticated SELECT active plans; admin full manage

**`business_subscriptions` table**
- business_id → businesses, plan_id → plans
- status (active/expired/pending/cancelled)
- started_at, expires_at, billing_cycle (monthly/yearly)
- amount_paid, payment_ref (nullable — manual for now), notes
- RLS: business owner + admin can view own; admin only can insert/update

**`ad_slots` table** (banner/featured ad inventory)
- slot_key (homepage_top, category_banner, event_sponsor, popular_search_featured)
- name, description, price_monthly, price_yearly
- max_active (kitne ads ek time pe)
- RLS: public SELECT; admin manage

Businesses table pe `current_plan_id` cache column add (for fast filtering).

Seed default 4 plans (Free/Silver/Gold/Platinum) + 4 ad slots via same migration.

### 2. Server functions (`src/lib/plans.functions.ts`)

- `listActivePlans()` — public
- `listAdSlots()` — public
- `getMyBusinessSubscription(businessId)` — authenticated
- `upsertPlan(...)` — admin only (has_role check)
- `deletePlan(id)` — admin only
- `upsertAdSlot(...)` — admin only
- `assignPlanToBusiness(businessId, planId, cycle, expiresAt, amountPaid, notes)` — admin only (manual assignment)
- `cancelBusinessSubscription(subId)` — admin only

### 3. Public Pricing Page — `src/routes/pricing.tsx`

- Hero: "Grow your business on Kutchi Hub"
- 4 pricing cards (Free/Silver/Gold/Platinum) with monthly/yearly toggle
- Feature comparison checklist per plan
- "Popular" badge on recommended tier
- CTA: "Get Started" → `/list-your-business` for Free; "Contact Admin" → WhatsApp/tel link for paid
- Ad slots section below: "Advertise with us" — 4 slot cards with pricing
- SEO head() with proper title/desc/og tags

### 4. Header/Footer link

Add "Pricing" link in Header + SiteFooter.

### 5. Admin Panel additions (`src/routes/_authenticated/admin.tsx`)

Add two new sections:

**"Plans & Pricing" section:**
- Table of plans with edit/delete
- Create/edit form: name, prices, features (multi-line), limits, perks toggles, popular flag, active toggle
- Reorder by tier_order

**"Ad Slots" section:**
- Table of ad slots with pricing
- Edit inline

**"Business Subscriptions" section:**
- Search business, view current plan
- Assign plan modal: pick plan, cycle, expiry date, amount paid, notes
- History table of past subscriptions

### 6. Business Dashboard hint (`src/routes/_authenticated/dashboard.tsx`)

Small card showing current plan of user's businesses + "Upgrade" button linking to `/pricing`.

### 7. Business Card badge

If business's `current_plan_id` → Gold/Platinum, show small crown/star badge on BusinessCard (visual only, cosmetic).

## Technical notes

- No payment gateway this phase — `payment_ref` and `amount_paid` are informational, admin fills manually.
- All admin mutations gated via `has_role(auth.uid(), 'admin')` inside server functions.
- Plans and ad_slots are `TO anon` SELECT (public reads) since pricing page must render SSR.
- `business_subscriptions` is `TO authenticated` only (owner sees own, admin sees all).
- Phase 2 (later): integrate Stripe/Razorpay checkout → auto-create subscription on successful payment webhook.

## Files to create/edit

Create:
- `supabase/migrations/<ts>_plans_subscriptions.sql`
- `src/lib/plans.functions.ts`
- `src/routes/pricing.tsx`
- `src/components/admin/PlansManager.tsx`
- `src/components/admin/AdSlotsManager.tsx`
- `src/components/admin/SubscriptionsManager.tsx`
- `src/components/pricing/PlanCard.tsx`

Edit:
- `src/routes/_authenticated/admin.tsx` (add 3 new tabs/sections)
- `src/routes/_authenticated/dashboard.tsx` (plan status card)
- `src/components/layout/Header.tsx` (Pricing link)
- `src/components/layout/SiteFooter.tsx` (Pricing link)
- `src/components/business/BusinessCard.tsx` (premium badge)
