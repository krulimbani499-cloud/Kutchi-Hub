# JustDial-Match Backend Plan

Aapki site me listings, reviews, favorites, claims, photos, banners already hain. Ye 6 core JustDial features backend me add karunga. Sirf schema + RLS + fetchers — UI baad me alag turn me.

## 1. Enquiries (Leads) — JustDial ka core

Users ko "Send Enquiry" button milega har business pe. Business owner ko lead dikhega dashboard me.

**Table `business_enquiries`**: business_id, user_id (nullable — guest allowed), name, phone, email, message, service_needed, city, status (new/contacted/closed), created_at.

- Anyone (anon+auth) can INSERT (rate-limit at app layer)
- Only business owner + admin can SELECT/UPDATE their enquiries
- User khud ki enquiries dekh sakta hai

## 2. Business Services / Menu

Har business ke andar services list (JustDial "Services offered").

**Table `business_services`**: business_id, name, description, price, price_unit (per hour/fixed/starts at), image_url, display_order.

- Public SELECT
- Owner + admin manage

## 3. Business Analytics (Views + Call clicks)

JustDial dashboard me "profile views" and "call clicks" dikhata hai.

**Table `business_events`**: business_id, event_type (view/call_click/whatsapp_click/website_click/direction_click), user_id (nullable), ip_hash, created_at.

- Anyone INSERT (log event)
- Owner + admin SELECT (analytics)
- Aggregation via SQL view `business_stats` (last 7d / 30d counts)

## 4. Review Replies

Owner reply karega reviews pe (JustDial feature).

**`business_reviews` me column add**: `owner_reply text`, `owner_reply_at timestamptz`.

- Only business owner can UPDATE those two columns

## 5. Notifications

Owner ko new review / enquiry / claim update pe notification.

**Table `notifications`**: user_id, type, title, body, link_url, read, entity_type, entity_id, created_at.

- User apni notifications dekh/update kar sakta hai
- Service role INSERT (triggers)

**Triggers**:
- New review → notify business owner
- New enquiry → notify business owner
- Claim approved/rejected → notify claimant

## 6. Reports / Flags

Fake listing / abusive review report karne ke liye.

**Table `reports`**: reporter_id, entity_type (business/review), entity_id, reason, details, status (open/reviewed/dismissed), created_at.

- Authenticated INSERT
- Admin SELECT/UPDATE all
- Reporter khud ki reports dekh sakta hai

---

## Migration order (single migration file)

```
CREATE TABLE business_enquiries + GRANTs + RLS + policies
CREATE TABLE business_services + GRANTs + RLS + policies
CREATE TABLE business_events + GRANTs + RLS + policies
ALTER business_reviews ADD owner_reply columns + policy update
CREATE TABLE notifications + GRANTs + RLS + policies
CREATE TABLE reports + GRANTs + RLS + policies
Triggers for notifications
Indexes on hot paths (business_id, created_at, user_id)
```

## Out of scope (this turn)

- UI components (forms, dashboards) — next turn ke liye
- Server functions / TanStack Query hooks — schema approve hone ke baad
- Payment/subscription for premium listings — pehle bataya, baad me

---

**Approve karo to migration file bhejta hoon. Agar koi feature nahi chahiye ya extra chahiye (e.g. chat/messaging, coupons, job listings, appointments booking), abhi batao.**