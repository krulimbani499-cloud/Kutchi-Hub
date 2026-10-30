import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activeEnterpriseBusinessIds, authEmailsByIds, createServerSupabaseClient, findAuthUserByEmail, uniqueBusinessSlug } from "./businesses.server";
import { BANNER_PLACEMENTS, composeHomeBanners, shuffleByPriority, showsInAllLocations, type BannerPlacement } from "./banner-rules";
import { completionChecklist, publishGaps } from "./listing-completeness";
import { cachedFor, clearCached } from "./server-cache";
import { findPhoneDuplicate } from "./quick-add";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { slugify, ensureSlug } from "./slug";
import { isValidIndianMobile, PHONE_ERROR } from "./phone";
import { httpsLink, optionalUrl, requiredUrl, WEBSITE_ERROR, SOCIAL_ERROR, MAPS_ERROR } from "./url";
import { CATALOG_PLAN_MESSAGE, EDIT_LOCKED_MESSAGE, friendlyEditError, isCatalogNotAllowedError } from "./edit-lock";
import { compareCategoryName } from "./category-sort";
import { canonicalCityName } from "./geolocation";
import { resolveCoords } from "./coords.server";
import { cityKey, haversineKm } from "./places";
import { isOpenNow, wallClockDate } from "./business-hours";
import { buildDirectory, type Directory, type DirectoryCategory, type DirectoryRow } from "./directory";
import { citySlug, parseKeywords, pickCityName, prettySlug, type CategoryLink } from "./seo-landing";
import { cleanSearchTerm, compareTop, matchedIn, pickHasNames, visibleMatches, type ShowSwitches } from "./all-business";
import { NEARBY_WIDE_RADIUS_KM, rankNearby } from "./nearby";
import cityCentres from "@/data/city-coords.json";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["relevance", "rating", "nearest", "newest", "discount"]).optional().default("relevance"),
  hasDiscount: z.coerce.boolean().optional().default(false),
  /** Only verified businesses. */
  verified: z.boolean().optional().default(false),
  /** Only businesses open right now (India time). Businesses without opening hours are left out. */
  openNow: z.boolean().optional().default(false),
  /** Where the visitor is: needed for the "nearest" order and for the distance on each result. */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** A locality was picked inside the city (lat / lng is its place): the default order puts the nearest businesses first. */
  areaFirst: z.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

export const searchBusinesses = createServerFn({ method: "GET" })
  .inputValidator((input) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const offset = (data.page - 1) * data.limit;

    let query = supabase
      .from("businesses")
      // categories is an inner join so the category filter below needs no separate lookup, and the
      // reviews come back embedded so ratings need no second query over the whole reviews table.
      .select(
        "id, name, slug, description, address, city, state, phone, verified, plan_tier_order, featured_image, hours, status, latitude, longitude, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id!inner(id, name, slug, color), business_reviews(rating)",
        // The true number of matching businesses comes back with the same query (no extra round trip).
        { count: "exact" },
      )
      .eq("status", "published");

    // If the search term matches any category name/slug, resolve those
    // category IDs so we can also match businesses tagged with them.
    let matchingCategoryIds: string[] = [];
    let matchingProductBusinessIds: string[] = [];
    if (data.q) {
      const term = data.q.trim();
      if (term) {
        // Match categories and businesses selling a matching product/service, all at once.
        const likeTerm = `%${term.replace(/[,()]/g, " ")}%`;
        const [{ data: cats }, { data: prodRows }, { data: svcRows }] = await Promise.all([
          supabase
            .from("categories")
            .select("id")
            .or(`name.ilike.%${term}%,slug.ilike.%${term}%`),
          supabase
            .from("business_products")
            .select("business_id")
            .eq("active", true)
            .or(`name.ilike.${likeTerm},description.ilike.${likeTerm},category.ilike.${likeTerm}`),
          supabase
            .from("business_services")
            .select("business_id")
            .or(`name.ilike.${likeTerm},description.ilike.${likeTerm}`),
        ]);
        matchingCategoryIds = (cats ?? []).map((c) => c.id);
        const ids = new Set<string>();
        for (const r of prodRows ?? []) ids.add(r.business_id);
        for (const r of svcRows ?? []) ids.add(r.business_id);
        matchingProductBusinessIds = [...ids];
      }
    }

    if (data.q) {
      const term = data.q.trim();
      if (term) {
        const like = term.replace(/[,()]/g, " ");
        const parts = [
          `name.ilike.%${like}%`,
          `description.ilike.%${like}%`,
          `city.ilike.%${like}%`,
        ];
        if (matchingCategoryIds.length > 0) {
          parts.push(`category_id.in.(${matchingCategoryIds.join(",")})`);
        }
        if (matchingProductBusinessIds.length > 0) {
          parts.push(`id.in.(${matchingProductBusinessIds.join(",")})`);
        }
        query = query.or(parts.join(","));
      }
    }

    if (data.category && data.category !== "all") {
      // Inner join on categories: an unknown slug simply yields no rows.
      query = query.eq("categories.slug", data.category);
    }

    if (data.city && data.city !== "all") {
      // Same exact, case-insensitive match as the home page (so "Vadagam" never shows "Vadagam (Aravalli)").
      // Spelling aliases still apply: typing "Dehgam" finds the businesses saved as "Dahegam".
      query = query.ilike("city", exactIlike(canonicalCityName(data.city)));
    }

    if (data.verified) query = query.eq("verified", true);

    if (data.hasDiscount) {
      const today = new Date().toISOString().slice(0, 10);
      query = query
        .gt("app_discount_percent", 0)
        .or(`app_discount_valid_until.is.null,app_discount_valid_until.gte.${today}`);
    }

    // The order is decided in the database so every page continues exactly where the last one stopped:
    //   relevance: plan priority, featured, verified, name;  newest: newest first;  discount: biggest discount first.
    // `id` is the last tie-breaker, so two businesses can never swap places between pages (no duplicates, none skipped).
    // "rating" and a minimum rating need the reviews of every match, "nearest" needs the distance to every match and
    // "open now" needs the opening hours of every match, so those modes load all matches (the database caps a response at
    // 1000 rows) and filter / sort / page them here. The total is still the exact number of matches.
    const here = data.lat !== undefined && data.lng !== undefined ? { lat: data.lat, lng: data.lng } : null;
    // "nearest" without a position falls back to the normal order. With a picked area the DEFAULT order is the nearest first too.
    const sortMode = data.sort === "relevance" && data.areaFirst && here !== null ? "nearest" : data.sort;
    const nearest = sortMode === "nearest" && here !== null;
    const inMemory = data.sort === "rating" || nearest || (data.minRating ?? 0) > 0 || data.openNow;
    let ordered = query;
    if (data.sort === "newest") ordered = ordered.order("created_at", { ascending: false });
    else if (data.sort === "discount") ordered = ordered.order("app_discount_percent", { ascending: false, nullsFirst: false });
    ordered = ordered
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    const { data: businesses, error, count } = await (inMemory ? ordered.range(0, 999) : ordered.range(offset, offset + data.limit - 1));
    if (error) throw new Error(error.message);

    let results = (businesses ?? []).map(({ business_reviews, latitude, longitude, ...b }) => {
      const reviews = business_reviews ?? [];
      const sum = reviews.reduce((total, r) => total + r.rating, 0);
      return {
        ...b,
        avgRating: reviews.length ? Number((sum / reviews.length).toFixed(1)) : 0,
        reviewCount: reviews.length,
        // Only the distance leaves the server, never the coordinates themselves.
        distanceKm: here && latitude != null && longitude != null ? Number(haversineKm(here.lat, here.lng, latitude, longitude).toFixed(1)) : null,
      };
    });

    let total = count ?? results.length;
    if (inMemory) {
      if ((data.minRating ?? 0) > 0) results = results.filter((b) => b.avgRating >= data.minRating!);
      if (data.openNow) {
        const clock = wallClockDate("Asia/Kolkata");
        results = results.filter((b) => isOpenNow(b.hours, clock) === true);
      }
      // Array.sort is stable: equal ratings / distances keep the plan-priority order above.
      if (data.sort === "rating") results = [...results].sort((a, b) => b.avgRating - a.avgRating);
      // Nearest first; a business without a location goes last.
      if (nearest) results = [...results].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      total = results.length;
      results = results.slice(offset, offset + data.limit);
    }

    // Extras for the businesses on THIS page only: more photos (the card can swipe through them) and a few service names.
    const extras = await loadListExtras(supabase, results.map((b) => b.id));
    const items = results.map((b) => ({ ...b, photos: extras.photos.get(b.id) ?? [], serviceTags: extras.services.get(b.id) ?? [] }));

    return {
      items,
      /** How many businesses match in total (not just on this page). */
      total,
      page: data.page,
      hasMore: offset + results.length < total,
    };
  });

const LIST_PHOTOS_PER_BUSINESS = 6;
const LIST_SERVICES_PER_BUSINESS = 3;

/**
 * Extra photos and service names for the cards of one results page (one query each, for the ids on the page only).
 * A business that switched "Show Services on my profile" OFF shows no service names; if that column does not exist yet
 * (section-toggles SQL not applied) every business is treated as ON, exactly like the profile page. A failing query
 * only means the card has no extras, never an error for the whole search.
 */
async function loadListExtras(supabase: ReturnType<typeof createServerSupabaseClient>, ids: string[]) {
  const photos = new Map<string, string[]>();
  const services = new Map<string, string[]>();
  if (ids.length === 0) return { photos, services };
  const [photoRes, serviceRes, toggleRes] = await Promise.all([
    supabase.from("business_photos").select("business_id, url, display_order").in("business_id", ids).order("display_order", { ascending: true }).limit(ids.length * 10),
    supabase.from("business_services").select("business_id, name, display_order").eq("active", true).in("business_id", ids).order("display_order", { ascending: true }).limit(ids.length * 10),
    supabase.from("businesses").select("id, show_services").in("id", ids),
  ]);
  for (const r of photoRes.data ?? []) {
    const list = photos.get(r.business_id) ?? [];
    if (list.length < LIST_PHOTOS_PER_BUSINESS && r.url) list.push(r.url);
    photos.set(r.business_id, list);
  }
  const hidden = new Set<string>();
  if (!toggleRes.error) for (const r of toggleRes.data ?? []) if ((r as { show_services?: boolean }).show_services === false) hidden.add(r.id);
  for (const r of serviceRes.data ?? []) {
    if (hidden.has(r.business_id) || !r.name?.trim()) continue;
    const list = services.get(r.business_id) ?? [];
    if (list.length < LIST_SERVICES_PER_BUSINESS) list.push(r.name.trim());
    services.set(r.business_id, list);
  }
  return { photos, services };
}

// ---------------------------------------------------------------------------------------------------------------------------
// ALL BUSINESS: every published business of every city (the "All Business" tab). The selected city is ignored.
// ---------------------------------------------------------------------------------------------------------------------------

const allBusinessSchema = z.object({
  /** Search text: business name, category, description, and the product / service names the owner shows publicly. */
  q: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  /** One city, as its address part (see citySlug): "himatnagar". */
  city: z.string().max(100).optional(),
  sort: z.enum(["relevance", "rating", "nearest", "newest", "discount"]).optional().default("relevance"),
  minRating: z.number().min(0).max(5).optional(),
  hasDiscount: z.boolean().optional().default(false),
  verified: z.boolean().optional().default(false),
  openNow: z.boolean().optional().default(false),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

const ALL_BUSINESS_COLUMNS =
  "id, name, slug, description, address, city, state, phone, verified, plan_tier_order, plan_featured, featured_image, hours, latitude, longitude, created_at, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color), business_reviews(rating)";

type AllBusinessRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  verified: boolean;
  plan_tier_order: number | null;
  plan_featured: boolean | null;
  featured_image: string | null;
  hours: Json | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  app_discount_percent: number | null;
  app_discount_label: string | null;
  app_discount_valid_until: string | null;
  categories: { id: string; name: string; slug: string; color: string | null } | null;
  business_reviews: Array<{ rating: number }> | null;
};

/** The product / service names that match, and which businesses they belong to. Only names the owner shows publicly count. */
async function matchProductsAndServices(supabase: ReturnType<typeof createServerSupabaseClient>, like: string) {
  const [prodRes, svcRes] = await Promise.all([
    // Trigram-indexable pattern on the name (perf-indexes SQL); only products that are switched on.
    supabase.from("business_products").select("business_id, name").eq("active", true).ilike("name", like).limit(500),
    supabase.from("business_services").select("business_id, name").eq("active", true).ilike("name", like).limit(500),
  ]);
  const ids = new Set<string>();
  for (const r of prodRes.data ?? []) ids.add(r.business_id);
  for (const r of svcRes.data ?? []) ids.add(r.business_id);
  if (ids.size === 0) return { has: new Map<string, string[]>(), ids: [] as string[] };

  // The owner's "Show Products / Services on my profile" switches (see visibleMatches). A failing query = the columns do not exist yet.
  const toggles = await supabase.from("businesses").select("id, show_products, show_services").in("id", [...ids]);
  return visibleMatches(prodRes.data ?? [], svcRes.data ?? [], toggles.error ? null : ((toggles.data ?? []) as ShowSwitches[]));
}

export const searchAllBusinesses = createServerFn({ method: "GET" })
  .inputValidator((input) => allBusinessSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const term = cleanSearchTerm(data.q);

    // ---- which businesses match the text: name / description / category in the query itself, products and services beside it
    let orFilter: string | null = null;
    let hasByBusiness = new Map<string, string[]>();
    if (term) {
      const like = `%${term}%`;
      const [catRes, items] = await Promise.all([
        supabase.from("categories").select("id").or(`name.ilike.${like},slug.ilike.${like}`),
        matchProductsAndServices(supabase, like),
      ]);
      hasByBusiness = items.has;
      // Business name, city, description (and below: the category, and the products / services the owner shows).
      const parts = [`name.ilike.${like}`, `city.ilike.${like}`, `description.ilike.${like}`];
      const catIds = (catRes.data ?? []).map((c) => c.id);
      if (catIds.length > 0) parts.push(`category_id.in.(${catIds.join(",")})`);
      if (items.ids.length > 0) parts.push(`id.in.(${items.ids.join(",")})`);
      orFilter = parts.join(",");
    }

    // ---- the matches, a thousand rows at a time (the database caps one answer at 1000)
    const rows: AllBusinessRow[] = [];
    for (let from = 0; from < 10_000; from += 1000) {
      let q = supabase.from("businesses").select(ALL_BUSINESS_COLUMNS).eq("status", "published").order("id", { ascending: true }).range(from, from + 999);
      if (orFilter) q = q.or(orFilter);
      const { data: chunk, error } = await q;
      if (error) throw new Error(error.message);
      rows.push(...((chunk ?? []) as unknown as AllBusinessRow[]));
      if ((chunk?.length ?? 0) < 1000) break;
    }

    const here = data.lat !== undefined && data.lng !== undefined ? { lat: data.lat, lng: data.lng } : null;
    const today = new Date().toISOString().slice(0, 10);
    const clock = data.openNow ? wallClockDate("Asia/Kolkata") : null;
    const rated = rows.map(({ business_reviews, latitude, longitude, ...b }) => {
      const reviews = business_reviews ?? [];
      const sum = reviews.reduce((total, r) => total + r.rating, 0);
      return {
        ...b,
        avgRating: reviews.length ? Number((sum / reviews.length).toFixed(1)) : 0,
        reviewCount: reviews.length,
        // Only the distance leaves the server, never the coordinates.
        distanceKm: here && latitude != null && longitude != null ? Number(haversineKm(here.lat, here.lng, latitude, longitude).toFixed(1)) : null,
        matchedHas: pickHasNames(hasByBusiness.get(b.id) ?? []),
        // What the text matched besides the name: the city and / or the category ("In: Dahegam").
        matchedIn: matchedIn(term, b.city, b.categories),
      };
    });

    // ---- the chips (everything except the city), then the cities with their counts, then the chosen city
    let list = rated.filter((b) => {
      if (data.category && b.categories?.slug !== data.category) return false;
      if (data.verified && !b.verified) return false;
      if (data.hasDiscount && !((b.app_discount_percent ?? 0) > 0 && (!b.app_discount_valid_until || b.app_discount_valid_until >= today))) return false;
      if ((data.minRating ?? 0) > 0 && b.avgRating < data.minRating!) return false;
      if (clock && isOpenNow(b.hours, clock) !== true) return false;
      return true;
    });
    const spellings = new Map<string, Map<string, number>>();
    for (const b of list) {
      if (!b.city) continue;
      const slug = citySlug(b.city);
      if (!slug) continue;
      const m = spellings.get(slug) ?? new Map<string, number>();
      m.set(b.city, (m.get(b.city) ?? 0) + 1);
      spellings.set(slug, m);
    }
    const cities = [...spellings.entries()]
      .map(([slug, m]) => ({ slug, name: pickCityName([...m].map(([name, count]) => ({ name, count }))), count: [...m.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const allTotal = list.length;
    const wantedCity = data.city ? citySlug(data.city) : "";
    if (wantedCity) list = list.filter((b) => !!b.city && citySlug(b.city) === wantedCity);

    // ---- the order: package tier, then rating, then newest (see compareTop); the other sorts fall back to it for ties
    const sort = data.sort === "nearest" && !here ? "relevance" : data.sort;
    list = [...list].sort((a, b) => {
      if (sort === "rating") return b.avgRating - a.avgRating || compareTop(a, b);
      if (sort === "newest") return b.created_at.localeCompare(a.created_at) || compareTop(a, b);
      if (sort === "discount") return (b.app_discount_percent ?? 0) - (a.app_discount_percent ?? 0) || compareTop(a, b);
      if (sort === "nearest") return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || compareTop(a, b);
      return compareTop(a, b);
    });

    const offset = (data.page - 1) * data.limit;
    const pageRows = list.slice(offset, offset + data.limit);
    const extras = await loadListExtras(supabase, pageRows.map((b) => b.id));
    const items = pageRows.map((b) => ({ ...b, photos: extras.photos.get(b.id) ?? [], serviceTags: extras.services.get(b.id) ?? [] }));
    return {
      items,
      /** Matches after every filter (including the chosen city). */
      total: list.length,
      /** Matches before the city filter: what the city chips add up to. */
      allTotal,
      cities,
      page: data.page,
      hasMore: offset + pageRows.length < list.length,
    };
  });

let profilesUnreadable = false;

export const getBusinessBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        slug: z.string().transform((s) => s.trim().toLowerCase()),
        city: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    let query = supabase
      .from("businesses")
      .select(
        "*, categories:category_id(id, name, slug, color, icon)",
      )
      .eq("slug", data.slug)
      .eq("status", "published");

    if (data.city) {
      query = query.eq("city", data.city);
    }

    // Two businesses can share a slug in old data: show the oldest instead of failing with "multiple rows".
    const { data: found, error } = await query.order("created_at", { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    const business = found?.[0] ?? null;
    if (!business) {
      // Not published. If it's merely awaiting review, say so (and nothing more);
      // rejected or missing businesses stay a plain not-found.
      let inReview = false;
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let pendingQuery = supabaseAdmin
          .from("businesses")
          .select("status")
          .eq("slug", data.slug)
          .eq("status", "pending");
        if (data.city) pendingQuery = pendingQuery.eq("city", data.city);
        const { data: pending } = await pendingQuery.limit(1);
        inReview = !!pending && pending.length > 0;
      } catch {
        // lookup unavailable — fall back to plain not-found
      }
      throw inReview ? notFound({ data: { inReview: true } }) : notFound();
    }

    // Reviews, photos and the catalog-plan check do not depend on each other: ask for all three at once.
    const [{ data: reviews }, { data: photos }, catalogAllowed] = await Promise.all([
      supabase.from("business_reviews").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
      supabase.from("business_photos").select("*").eq("business_id", business.id).order("display_order", { ascending: true }),
      // Show the catalog only while the business's active plan includes it. Nothing is deleted: the file and the
      // saved values stay, they just are not shown. Fails open (shown, as before) if the database function is missing.
      business.catalog_url || business.catalog_link
        ? supabase
            .rpc("business_can_use_catalog", { _business_id: business.id })
            .then(({ data: canCatalog, error: canCatalogError }) => (canCatalogError ? true : canCatalog === true))
        : Promise.resolve(true),
    ]);

    const userIds = [...new Set((reviews ?? []).map((r) => r.user_id))];
    const profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    // The public key has no read access to profiles (permission denied since the 2026-07-07 privacy change), so this lookup
    // answers nothing. Once it has failed on this server instance it is not tried again (one wasted round trip per page view).
    if (userIds.length > 0 && !profilesUnreadable) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      if (profileError && (profileError.code === "42501" || /permission denied/i.test(profileError.message))) profilesUnreadable = true;
      for (const p of profileRows ?? []) {
        profiles[p.user_id] = p;
      }
    }

    const reviewsWithProfiles = (reviews ?? []).map((r) => ({
      ...r,
      profiles: profiles[r.user_id] ?? null,
    }));

    const avgRating =
      reviews && reviews.length > 0
        ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
        : 0;

    return {
      business: { ...business, catalog_allowed: catalogAllowed },
      reviews: reviewsWithProfiles,
      photos: photos ?? [],
      avgRating,
      reviewCount: reviews?.length ?? 0,
    };
  });

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
});

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createCategorySchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const name = data.name.trim();
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "category";

    // Reuse if a category with the same slug or case-insensitive name already exists.
    const { data: existing } = await supabase
      .from("categories")
      .select("*")
      .or(`slug.eq.${baseSlug},name.ilike.${name}`)
      .maybeSingle();
    if (existing) return existing;

    let slug = baseSlug;
    for (let i = 2; i < 20; i++) {
      const { data: hit } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
      if (!hit) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: inserted, error } = await supabase
      .from("categories")
      .insert({ name, slug })
      .select("*")
      .single();
    if (error) throw new Error(friendlyBannerError(error));
    return inserted;
  });

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().transform((s) => slugify(s, 80)).pipe(z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only")),
  icon: z.string().trim().max(60).nullable().optional(),
  icon_url: z.string().trim().max(500).nullable().optional(),
  color: z.string().trim().max(30).nullable().optional(),
  display_order: z.coerce.number().int().min(0).max(9999).optional(),
  popular_image_url: z.string().trim().max(600000).nullable().optional(),
  popular_featured: z.boolean().optional(),
  /** Comma-separated synonyms for the landing page text ("dealers, suppliers, near me"). Needs supabase/pending/category-seo-keywords. */
  seo_keywords: z.string().trim().max(300).nullable().optional(),
});

const SEO_KEYWORDS_NEEDS_MIGRATION =
  "Keywords need a database update first (supabase/pending/category-seo-keywords). Nothing was saved.";

async function assertAdmin(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const adminUpdateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateCategorySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: {
      name: string;
      slug: string;
      icon?: string | null;
      icon_url?: string | null;
      color?: string | null;
      display_order?: number;
      popular_image_url?: string | null;
      popular_featured?: boolean;
      seo_keywords?: string | null;
    } = {
      name: data.name.trim(),
      slug: data.slug.trim(),
    };
    if (data.icon !== undefined) patch.icon = data.icon?.trim() || null;
    if (data.icon_url !== undefined) patch.icon_url = data.icon_url?.trim() || null;
    if (data.color !== undefined) patch.color = data.color?.trim() || null;
    if (data.display_order !== undefined) patch.display_order = data.display_order;
    if (data.popular_image_url !== undefined) patch.popular_image_url = data.popular_image_url?.trim() || null;
    if (data.popular_featured !== undefined) patch.popular_featured = data.popular_featured;
    // Cleaned the same way the pages read them: lower case, no duplicates, at most 8. Empty = no keywords.
    if (data.seo_keywords !== undefined) patch.seo_keywords = parseKeywords(data.seo_keywords).join(", ") || null;

    const { data: updated, error } = await context.supabase
      .from("categories")
      .update(patch as never)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) {
      // The column does not exist yet (SQL not applied): say so, and only when keywords were being saved.
      if (data.seo_keywords !== undefined && (error.code === "42703" || error.code === "PGRST204" || /seo_keywords/i.test(error.message))) {
        throw new Error(SEO_KEYWORDS_NEEDS_MIGRATION);
      }
      throw new Error(friendlyBannerError(error));
    }
    clearCached("directory"); // the landing pages read keywords from the directory cache
    return updated;
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Guard: reject if any business uses this category
    const { count, error: countErr } = await context.supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(`Cannot delete: ${count} business(es) are using this category.`);
    }
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Banner ads ----------

const normalizeBannerImageUrl = (url: string) => {
  const trimmed = url.trim();
  return trimmed.startsWith("/__l5e/") ? `https://kutchi-hub.lovable.app${trimmed}` : trimmed;
};

// Exact, case-insensitive match via ilike: escape LIKE wildcards (% and _), and drop "*"
// because PostgREST treats it as "%". No real city name contains any of these.
const exactIlike = (value: string) => value.replace(/\*/g, "").replace(/[\\%_]/g, "\\$&");

// `business` rides along in the same query: the slug of the business page a banner opens (only a published one is visible to the
// public key; anything else comes back null). It replaces a second round trip.
const BANNER_SELECT =
  "id, business_id, title, subtitle, image_url, mobile_image_url, cta_label, cta_url, city, priority, created_at, business:business_id(slug, status)";
const BANNER_SELECT_NEW = `${BANNER_SELECT}, placement, show_all_cities`;

/** True when the database does not have the placement / show_all_cities columns yet (banner-placement/01_migration.sql). */
const isMissingBannerColumns = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "42703" || error.code === "PGRST204" || /placement|show_all_cities/.test(error.message ?? ""));

export const getBannerAdsForCity = createServerFn({ method: "GET" })
  // `all` = the person explicitly chose "All locations": every active banner, whatever its city.
  // `placement` = which homepage slot: the top one (default, as before) or the middle one.
  .inputValidator((input) =>
    z
      .object({
        city: z.string().trim().min(1).max(80).optional(),
        all: z.boolean().optional(),
        placement: z.enum(BANNER_PLACEMENTS as unknown as [BannerPlacement, ...BannerPlacement[]]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    // Only show banners for the selected city. If no city is selected AND "All locations" was not chosen,
    // return nothing so city-specific banners don't leak across locations.
    if (!data.city && !data.all) return [];
    const placement: BannerPlacement = data.placement ?? "home_top";
    const now = new Date().toISOString();

    const live = (select: string) =>
      supabase
        .from("banner_ads")
        .select(select)
        .is("category_id", null)
        .eq("active", true)
        .lte("start_at", now)
        .or(`end_at.is.null,end_at.gte.${now}`);
    type Row = {
      id: string;
      business_id: string | null;
      title: string;
      subtitle: string | null;
      image_url: string;
      mobile_image_url: string | null;
      cta_label: string | null;
      cta_url: string | null;
      city: string;
      priority: number;
      created_at: string;
      business: { slug: string; status: string } | null;
    };

    // "All locations": only banners of a business with an ACTIVE Enterprise plan (published, subscription active, started, not
    // expired: the same check as "Show in all cities"), whatever the "Show in all cities" box says. Fails closed: if the plan
    // cannot be checked, nothing shows. Nothing left = an empty list = the slot is not drawn.
    const allLocationsOnly = !!data.all && !data.city;
    const onlyActiveEnterprise = async (list: Row[]): Promise<Row[]> => {
      try {
        const ok = await activeEnterpriseBusinessIds(list.map((r) => r.business_id).filter((id): id is string => !!id));
        return list.filter((r) => !!r.business_id && ok.has(r.business_id));
      } catch {
        return [];
      }
    };

    let rows: Row[] = [];
    // 1) The visitor's own city (or, with "All locations", every city) in this slot.
    let own = live(BANNER_SELECT_NEW)
      .eq("placement", placement)
      // Priority only: the date a banner was created never decides (the order inside a priority is random, see composeHomeBanners).
      // Enough candidates are fetched so the cap of 10 below cuts a random few, not the oldest ones.
      .order("priority", { ascending: false })
      .limit(allLocationsOnly ? 500 : 200);
    // All locations: a banner without a business can never be Enterprise, so it is left out before the plan check.
    if (allLocationsOnly) own = own.not("business_id", "is", null);
    if (data.city) own = own.ilike("city", exactIlike(data.city));
    const ownRes = await own;
    if (isMissingBannerColumns(ownRes.error)) {
      // Database not updated yet: every banner is a top banner, exactly as before. The middle slot stays empty.
      if (placement === "home_middle") return [];
      let legacy = live(BANNER_SELECT).limit(200).order("priority", { ascending: false });
      if (data.city) legacy = legacy.ilike("city", exactIlike(data.city));
      const legacyRes = await legacy;
      if (legacyRes.error) throw new Error(legacyRes.error.message);
      rows = (legacyRes.data ?? []) as unknown as Row[];
      if (allLocationsOnly) rows = await onlyActiveEnterprise(rows);
      rows = composeHomeBanners(rows, [], allLocationsOnly ? undefined : 10);
    } else {
      if (ownRes.error) throw new Error(ownRes.error.message);
      rows = (ownRes.data ?? []) as unknown as Row[];
      // 2) Middle slot of a city: then the "show in all cities" banners of OTHER cities whose business still has an
      //    active Enterprise plan. (In "All locations" mode every banner already appears in its own slot above.)
      if (data.city && placement === "home_middle") {
        const { data: others, error: othersError } = await live(BANNER_SELECT_NEW)
          .eq("show_all_cities", true)
          .not("business_id", "is", null)
          .not("city", "ilike", exactIlike(data.city))
          .order("priority", { ascending: false })
          .limit(100);
        if (othersError) throw new Error(othersError.message);
        const candidates = (others ?? []) as unknown as Row[];
        let allowed = new Set<string>();
        try {
          allowed = await activeEnterpriseBusinessIds(candidates.map((c) => c.business_id!));
        } catch {
          // Cannot verify the plan: show nothing outside the banner's own city (fail closed).
        }
        const extra = candidates.filter((c) => c.business_id && allowed.has(c.business_id));
        rows = composeHomeBanners(rows, extra, 10);
      } else if (allLocationsOnly) {
        rows = composeHomeBanners(await onlyActiveEnterprise(rows), []);
      } else if (data.all) {
        rows = composeHomeBanners(rows, []);
      } else {
        rows = composeHomeBanners(rows, [], 10);
      }
    }
    // Banners that name a business open its page (published businesses only: a visitor cannot open anything else).
    return rows.map(({ business, ...banner }) => ({
      ...banner,
      business_slug: business && business.status === "published" ? business.slug : null,
      image_url: normalizeBannerImageUrl(banner.image_url),
      mobile_image_url: banner.mobile_image_url ? normalizeBannerImageUrl(banner.mobile_image_url) : null,
    }));
  });

export const getBannerAdsForCategory = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({ categoryId: z.string().uuid(), city: z.string().trim().min(1).max(80).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const now = new Date().toISOString();
    let query = supabase
      .from("banner_ads")
      .select("id, business_id, title, subtitle, image_url, mobile_image_url, cta_label, cta_url, city, priority")
      .eq("category_id", data.categoryId)
      .eq("active", true)
      .lte("start_at", now)
      .or(`end_at.is.null,end_at.gte.${now}`);
    // No city given => banners from all cities (unchanged behaviour).
    if (data.city) query = query.ilike("city", exactIlike(data.city));
    // Priority first, then a random order inside each priority (never by date); the cap of 10 cuts a random few.
    const { data: banners, error } = await query.order("priority", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return shuffleByPriority(banners ?? []).slice(0, 10).map((banner) => ({
      ...banner,
      image_url: normalizeBannerImageUrl(banner.image_url),
      mobile_image_url: banner.mobile_image_url ? normalizeBannerImageUrl(banner.mobile_image_url) : null,
    }));
  });

const bannerInputSchema = z.object({
  business_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(200).nullable().optional(),
  image_url: z.string().trim().url().max(500),
  mobile_image_url: z.string().trim().url().max(500).nullable().optional(),
  cta_label: z.string().trim().max(40).nullable().optional(),
  cta_url: z.string().trim().url().max(500).nullable().optional(),
  city: z.string().trim().min(1).max(80),
  priority: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().nullable().optional(),
  placement: z.enum(BANNER_PLACEMENTS as unknown as [BannerPlacement, ...BannerPlacement[]]).default("home_top"),
  show_all_cities: z.boolean().default(false),
});

const BANNER_NEEDS_MIGRATION =
  "The banner placement database update has not been applied yet (supabase/pending/banner-placement/01_migration.sql). Only top, single-city banners can be saved until then.";
const ALL_CITIES_NEEDS_ENTERPRISE = "\"Show in all cities\" needs a business with an active Enterprise plan. Pick that business, or untick the box.";

/**
 * Rules the form cannot be trusted with. A banner shown in all cities must name a business that has an ACTIVE Enterprise plan
 * right now, and (like every homepage banner) is not a category banner. Placement and the all-cities flag only apply to
 * homepage banners.
 */
async function assertBannerRules(data: z.infer<typeof bannerInputSchema>) {
  if (data.category_id && (data.show_all_cities || data.placement !== "home_top")) {
    throw new Error("Placement and \"Show in all cities\" are for homepage banners only. Remove the category, or use Top and leave the box unticked.");
  }
  if (!data.show_all_cities) return;
  if (!data.business_id) throw new Error(ALL_CITIES_NEEDS_ENTERPRISE);
  let ok = false;
  try {
    ok = (await activeEnterpriseBusinessIds([data.business_id])).has(data.business_id);
  } catch {
    throw new Error("Could not check the business's plan right now. Please try again.");
  }
  if (!ok) throw new Error(ALL_CITIES_NEEDS_ENTERPRISE);
}

/** The new columns are only written when they differ from the defaults, so saving an ordinary banner works before the SQL runs. */
function bannerPlacementColumns(data: { placement: BannerPlacement; show_all_cities: boolean }) {
  return data.placement === "home_top" && !data.show_all_cities ? {} : { placement: data.placement, show_all_cities: data.show_all_cities };
}

const friendlyBannerError = (error: { code?: string; message: string }) =>
  isMissingBannerColumns(error) ? BANNER_NEEDS_MIGRATION : error.message;

export const adminListBannerAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("banner_ads")
      .select("*, business:business_id(name, city, slug)")
      .order("city", { ascending: true })
      .order("priority", { ascending: false });
    if (error) throw new Error(error.message);
    // A banner shows in "All locations" when it is a homepage banner that is live now and its business has an ACTIVE Enterprise
    // plan (the same check the visitor query uses). If the plan cannot be checked, none is flagged.
    let enterprise = new Set<string>();
    try {
      enterprise = await activeEnterpriseBusinessIds((data ?? []).filter((b) => !b.category_id && b.business_id).map((b) => b.business_id as string));
    } catch {
      // no badges
    }
    return (data ?? []).map((b) => ({
      ...b,
      business: (b as unknown as { business: { name: string; city: string | null; slug: string } | null }).business,
      shows_in_all_locations: showsInAllLocations(b, enterprise),
    }));
  });

/**
 * Published businesses for the banner form's "Business" picker, each with whether it has an active Enterprise plan right now
 * (which is what allows "Show in all cities"). Admin only.
 */
export const adminBannerBusinessOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("businesses")
      .select("id, name, city")
      .eq("status", "published")
      .order("name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    let enterprise = new Set<string>();
    try {
      enterprise = await activeEnterpriseBusinessIds(rows.map((r) => r.id));
    } catch {
      // the picker still works; the all-cities box just stays disabled
    }
    return rows.map((r) => ({ id: r.id, name: r.name, city: r.city ?? "", enterprise: enterprise.has(r.id) }));
  });

export const adminCreateBannerAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bannerInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertBannerRules(data);
    const { data: inserted, error } = await context.supabase
      .from("banner_ads")
      .insert({
        ...bannerPlacementColumns(data),
        business_id: data.business_id ?? null,
        category_id: data.category_id ?? null,
        owner_id: context.userId,
        title: data.title,
        subtitle: data.subtitle ?? null,
        image_url: normalizeBannerImageUrl(data.image_url),
        mobile_image_url: data.mobile_image_url ? normalizeBannerImageUrl(data.mobile_image_url) : null,
        cta_label: data.cta_label ?? null,
        cta_url: data.cta_url ?? null,
        city: data.city,
        priority: data.priority,
        active: data.active,
        start_at: data.start_at,
        end_at: data.end_at ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const adminUpdateBannerAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bannerInputSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertBannerRules(data);
    const { id, ...rest } = data;
    const { data: updated, error } = await context.supabase
      .from("banner_ads")
      .update({
        ...bannerPlacementColumns(rest),
        business_id: rest.business_id ?? null,
        category_id: rest.category_id ?? null,
        title: rest.title,
        subtitle: rest.subtitle ?? null,
        image_url: normalizeBannerImageUrl(rest.image_url),
        mobile_image_url: rest.mobile_image_url ? normalizeBannerImageUrl(rest.mobile_image_url) : null,
        cta_label: rest.cta_label ?? null,
        cta_url: rest.cta_url ?? null,
        city: rest.city,
        priority: rest.priority,
        active: rest.active,
        start_at: rest.start_at,
        end_at: rest.end_at ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const adminDeleteBannerAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("banner_ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const HOME_CATEGORY_TILES = 12;

/**
 * Number of PUBLISHED businesses per category, optionally only in one city (same exact, case-insensitive
 * match as the banners). One query shape, paged because PostgREST returns at most 1000 rows per request.
 */
async function countPublishedByCategory(supabase: ReturnType<typeof createServerSupabaseClient>, city?: string) {
  const PAGE = 1000;
  const counts = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("businesses")
      .select("category_id")
      .eq("status", "published")
      .not("category_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (city) query = query.ilike("city", exactIlike(city));
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    if ((data ?? []).length < PAGE) break;
  }
  return counts;
}

/** Categories with at least one business, most businesses first, ties A–Z by name. */
function rankByCount<T extends { id: string; name: string }>(categories: T[], counts: Map<string, number>) {
  return categories
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({ ...c, businessCount: counts.get(c.id) as number }))
    .sort((a, b) => b.businessCount - a.businessCount || compareCategoryName(a, b));
}

/**
 * Popular Categories: the selected city's ranking first; if it has fewer categories than `limit`, the rest
 * is filled with the overall (all cities) ranking, without repeats.
 * `businessCount` (shown on the tile) is set for tiles counted in the selected city, and for every tile when no
 * city is selected. Fill-in tiles have no `businessCount`, so they show no number.
 */
function rankPopularCategories<T extends { id: string; name: string }>(
  categories: T[],
  cityCounts: Map<string, number> | null,
  overallCounts: Map<string, number>,
  limit: number,
): Array<T & { businessCount?: number }> {
  if (!cityCounts) return rankByCount(categories, overallCounts).slice(0, limit);
  const picked: Array<T & { businessCount?: number }> = rankByCount(categories, cityCounts).slice(0, limit);
  if (picked.length >= limit) return picked;
  const taken = new Set(picked.map((c) => c.id));
  const fill = rankByCount(categories, overallCounts)
    .filter((c) => !taken.has(c.id))
    .map(({ businessCount: _overall, ...category }) => category as unknown as T);
  return [...picked, ...fill].slice(0, limit);
}

/**
 * Rows that were selected with `business_reviews(rating)` embedded: turns the embedded ratings into avgRating / reviewCount.
 * (Reading ratings in the SAME query replaces a second round trip to the database on every listing page.)
 */
function withRatingSummary<T extends { business_reviews?: Array<{ rating: number }> | null }>(rows: T[] | null | undefined) {
  return (rows ?? []).map(({ business_reviews, ...rest }) => {
    const reviews = business_reviews ?? [];
    const sum = reviews.reduce((total, r) => total + r.rating, 0);
    return {
      ...rest,
      avgRating: reviews.length ? Number((sum / reviews.length).toFixed(1)) : 0,
      reviewCount: reviews.length,
    };
  });
}

/** Drops the coordinates from home rows; with a position, puts the nearest first (a business without coordinates after them, in its old order). */
function orderByDistance<T extends { latitude?: number | null; longitude?: number | null }>(rows: T[], at: { lat: number; lng: number } | null) {
  const withDistance = rows.map(({ latitude, longitude, ...rest }) => ({
    ...rest,
    distanceKm: at && latitude != null && longitude != null ? Number(haversineKm(at.lat, at.lng, latitude, longitude).toFixed(1)) : null,
  }));
  return at ? [...withDistance].sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity)) : withDistance;
}

export const getHomeData = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ city: z.string().optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).optional().parse(input) ?? {},
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const city = data?.city?.trim();
    let featuredQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, latitude, longitude, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color), business_reviews(rating)")
      .eq("status", "published")
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .limit(8);
    if (city) featuredQuery = featuredQuery.ilike("city", city);

    // Platinum spotlight: Platinum (4) & Enterprise (5) only — the auto-showcase perk
    let spotlightQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, latitude, longitude, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color), business_reviews(rating)")
      .eq("status", "published")
      .gte("plan_tier_order", 4)
      .order("plan_tier_order", { ascending: false })
      .order("verified", { ascending: false })
      .limit(8);
    if (city) spotlightQuery = spotlightQuery.ilike("city", city);

    const today = new Date().toISOString().slice(0, 10);
    let offersQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, latitude, longitude, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color), business_reviews(rating)")
      .eq("status", "published")
      .gt("app_discount_percent", 0)
      .or(`app_discount_valid_until.is.null,app_discount_valid_until.gte.${today}`)
      .order("app_discount_percent", { ascending: false })
      .limit(8);
    if (city) offersQuery = offersQuery.ilike("city", city);

    // Popular Categories are ranked by published businesses: in the selected city first, then (to fill the
    // tiles) overall. Two count queries run in parallel with the rest — never one query per category.
    // Everything runs at once. The category list and the per-category counts change rarely, so each server instance keeps them
    // for a minute (cachedFor) instead of asking the database on every home page view.
    const [
      { data: allCategories },
      { data: featured },
      { data: offers },
      { data: spotlight },
      cityCounts,
      overallCounts,
    ] = await Promise.all([
      cachedFor("home:categories", 60_000, async () => {
        const res = await supabase.from("categories").select("*").order("display_order", { ascending: true });
        if (res.error) throw new Error(res.error.message);
        return res;
      }),
      featuredQuery,
      offersQuery,
      spotlightQuery,
      city ? cachedFor(`home:counts:${city.toLowerCase()}`, 60_000, () => countPublishedByCategory(supabase, city)) : Promise.resolve(null),
      cachedFor("home:counts:*", 60_000, () => countPublishedByCategory(supabase)),
    ]);
    const categories = rankPopularCategories(allCategories ?? [], cityCounts, overallCounts, HOME_CATEGORY_TILES);

    // A locality picked inside the city (lat / lng): each section lists its businesses nearest to it first (without a position last).
    const at = data?.lat !== undefined && data?.lng !== undefined ? { lat: data.lat, lng: data.lng } : null;
    const listings = orderByDistance(withRatingSummary(featured), at);
    const topOffers = orderByDistance(withRatingSummary(offers), at);
    const platinumSpotlight = orderByDistance(withRatingSummary(spotlight), at);

    return { categories, featured: listings, topOffers, platinumSpotlight };
  });

// Personalized recommendations based on the user's recently-viewed categories.
// Client passes category slugs (from localStorage) + business IDs to exclude.
export const getRecommendations = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        categorySlugs: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
        excludeIds: z.array(z.string().uuid()).max(24).default([]),
        city: z.string().trim().max(80).optional(),
        limit: z.coerce.number().int().min(1).max(12).optional().default(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.categorySlugs.length === 0) return [];
    const supabase = createServerSupabaseClient();

    const { data: cats } = await supabase
      .from("categories")
      .select("id")
      .in("slug", data.categorySlugs);
    const categoryIds = (cats ?? []).map((c) => c.id);
    if (categoryIds.length === 0) return [];

    let query = supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .in("category_id", categoryIds)
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .limit(data.limit * 2);

    if (data.city) query = query.ilike("city", data.city);
    if (data.excludeIds.length > 0) {
      query = query.not("id", "in", `(${data.excludeIds.join(",")})`);
    }

    const { data: businesses, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (businesses ?? []).map((b) => b.id);
    let ratings = new Map<string, { count: number; sum: number }>();
    if (ids.length > 0) {
      const { data: counts } = await supabase
        .from("business_reviews")
        .select("business_id, rating")
        .in("business_id", ids);
      for (const r of counts ?? []) {
        const e = ratings.get(r.business_id) ?? { count: 0, sum: 0 };
        e.count += 1;
        e.sum += r.rating;
        ratings.set(r.business_id, e);
      }
    }

    return (businesses ?? []).slice(0, data.limit).map((b) => {
      const r = ratings.get(b.id);
      return {
        ...b,
        avgRating: r ? Number((r.sum / r.count).toFixed(1)) : 0,
        reviewCount: r?.count ?? 0,
      };
    });
  });

const businessFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(120),
  slug: z.string().transform((s) => ensureSlug(s)).pipe(z.string().min(2).max(120)),
  category_id: z.string().uuid(),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120),
  state: z.string().max(120).optional(),
  pincode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  phone_secondary: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || isValidIndianMobile(v), PHONE_ERROR)
    .optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  website: optionalUrl(WEBSITE_ERROR),
  instagram_url: optionalUrl(SOCIAL_ERROR),
  facebook_url: optionalUrl(SOCIAL_ERROR),
  youtube_url: optionalUrl(SOCIAL_ERROR),
  google_maps_url: requiredUrl(MAPS_ERROR),
  // latitude / longitude are NOT accepted from the browser: the server works them out from the map link / address
  // (see resolveBusinessCoords). Any value sent is dropped by this schema.
  hours: z.record(z.string()).optional(),
  featured_image: z.string().max(1000).optional().or(z.literal("")),
  app_discount_percent: z.coerce.number().int().min(0).max(100).nullable().optional(),
  app_discount_label: z.string().max(80).optional().or(z.literal("")),
  app_discount_valid_until: z.string().max(20).optional().or(z.literal("")),
  // "Show Services / Products on my profile". Sent by the edit form only when the owner changed them.
  show_services: z.boolean().optional(),
  show_products: z.boolean().optional(),
  // Catalog link (Google Drive, ...): https:// only. "" clears it. Sent by the edit form only when it changed.
  catalog_link: httpsLink(),
});

const CATALOG_LINK_NEEDS_MIGRATION =
  "The catalog link needs a database update first (supabase/pending/catalog-link). Nothing was saved.";

const SECTION_TOGGLES_NEED_MIGRATION =
  "The Services / Products switches need a database update first (supabase/pending/section-toggles). Nothing was saved.";

/**
 * Coordinates for the "Nearby Businesses" section, worked out on the server from the Google Maps link
 * (or the address). Never throws and never takes long: when it can't be resolved the business is saved without them.
 */
async function resolveBusinessCoords(
  fields: { google_maps_url?: string | null; address?: string | null; city?: string | null; state?: string | null },
  userId: string,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const found = await Promise.race([
      resolveCoords(fields, {
        geocodeKey: process.env.GOOGLE_MAPS_API_KEY,
        rateLimitKey: `save:${userId}`,
        // City centres we already know (src/data/city-coords.json) catch geocoder answers that landed in the wrong town.
        cityCentre: fields.city ? (cityCentres as Record<string, { lat: number; lng: number }>)[cityKey(fields.city)] : null,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 9000)),
    ]);
    return found ? { latitude: found.lat, longitude: found.lng } : null;
  } catch {
    return null;
  }
}

/** True when a query failed because a column does not exist yet (the quick-listing SQL has not been applied). */
const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && (error.code === "42703" || error.code === "PGRST204" || /does not exist|schema cache/i.test(error.message ?? ""));

/** Rows in business_photos per business, for the businesses given. */
async function photoCountsFor(supabase: ReturnType<typeof createServerSupabaseClient>, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data } = await supabase.from("business_photos").select("business_id").in("business_id", ids).limit(20000);
  for (const row of data ?? []) counts.set(row.business_id, (counts.get(row.business_id) ?? 0) + 1);
  return counts;
}

/** True when an insert / update failed because another business already has that slug (unique index, SQLSTATE 23505). */
function isSlugConflict(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" && /slug/i.test(error.message ?? "");
}

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => businessFormSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    const coords = await resolveBusinessCoords(data, userId);

    // The slug is the page address (/business/<slug>), so it must be unique across ALL businesses. Checked here on the
    // server (the form cannot know about other owners' pending listings); a taken slug becomes slug-2, slug-3, ...
    const row = (slug: string) => ({
      ...data,
      slug,
      ...(coords ?? {}),
      owner_id: userId,
      status: "pending",
      phone_secondary: data.phone_secondary || null,
      website: data.website || null,
      email: data.email || null,
      instagram_url: data.instagram_url || null,
      facebook_url: data.facebook_url || null,
      youtube_url: data.youtube_url || null,
      google_maps_url: data.google_maps_url || null,
      featured_image: data.featured_image || null,
      app_discount_percent:
        data.app_discount_percent == null || Number.isNaN(data.app_discount_percent)
          ? null
          : data.app_discount_percent,
      app_discount_label: data.app_discount_label ? data.app_discount_label : null,
      app_discount_valid_until: data.app_discount_valid_until ? data.app_discount_valid_until : null,
    });
    let business: { id: string; slug: string } | null = null;
    // Two sign-ups choosing the same slug at the same moment: the second insert fails on the unique index (once
    // unique-slug/02_migration.sql is applied); ask again and take the next free one.
    for (let attempt = 0; attempt < 3 && !business; attempt++) {
      const slug = await uniqueBusinessSlug(data.slug, { fallbackClient: supabase });
      const { data: inserted, error } = await supabase.from("businesses").insert(row(slug)).select("id, slug").single();
      if (!error) {
        business = inserted;
      } else if (!isSlugConflict(error) || attempt === 2) {
        throw new Error(error.message);
      }
    }
    if (!business) throw new Error("Could not create the business. Please try again.");

    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "business_owner" });
    if (!isOwner) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "business_owner" }).select();
    }

    return business;
  });

const QUICK_NEEDS_MIGRATION =
  "Quick listing is not switched on yet (supabase/pending/quick-listing/01_migration.sql has not been applied).";

const quickListingSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name").max(120),
  contactName: z.string().trim().min(2, "Enter the contact person's name").max(80),
  phone: z.string().trim().max(30).refine(isValidIndianMobile, PHONE_ERROR),
  city: z.string().trim().min(1, "Choose the city").max(120),
  categoryId: z.string().uuid().nullable().optional(),
});

/** Which "list your business" form this person gets: admins always the full one; everyone else the quick one once the database is ready. */
export const getListingFlow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const probe = await context.supabase.from("businesses").select("quick_lead").limit(1);
    return { isAdmin: !!isAdmin, quickReady: !probe.error };
  });

/**
 * The quick form: business name, contact person, phone, city (category optional). Creates a PENDING business flagged as a
 * quick lead; nothing is invented for the fields that were not asked. Admins use the full form instead.
 */
export const createQuickListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => quickListingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdmin) throw new Error("Admins add businesses with the full form.");

    // A double tap sends the same lead twice: return the one just created instead of adding a second.
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from("businesses")
      .select("id, slug")
      .eq("owner_id", userId)
      .eq("quick_lead", true)
      .ilike("name", exactIlike(data.name))
      .gte("created_at", since)
      .limit(1);
    if (recentError) throw new Error(isMissingColumnError(recentError) ? QUICK_NEEDS_MIGRATION : recentError.message);
    if (recent && recent[0]) return { id: recent[0].id, slug: recent[0].slug };

    const base = ensureSlug(data.name);
    let business: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 3 && !business; attempt++) {
      const slug = await uniqueBusinessSlug(base, { fallbackClient: supabase });
      const { data: inserted, error } = await supabase
        .from("businesses")
        .insert({
          name: data.name,
          slug,
          city: data.city,
          phone: data.phone,
          contact_name: data.contactName,
          category_id: data.categoryId ?? null,
          owner_id: userId,
          status: "pending",
          quick_lead: true,
        })
        .select("id, slug")
        .single();
      if (!error) {
        business = inserted;
      } else if (isMissingColumnError(error) || error.code === "23502") {
        throw new Error(QUICK_NEEDS_MIGRATION);
      } else if (!isSlugConflict(error) || attempt === 2) {
        throw new Error(error.message);
      }
    }
    if (!business) throw new Error("Could not save your listing. Please try again.");

    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "business_owner" });
    if (!isOwner) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "business_owner" }).select();
    }
    return business;
  });

export const updateBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => businessFormSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    if (!data.id) throw new Error("Business id is required");

    const { data: existing, error: existingError } = await supabase
      .from("businesses")
      .select("owner_id, slug, google_maps_url, address, city, state, latitude, longitude")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Business not found");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (existing.owner_id !== userId && !isAdmin) throw new Error("Unauthorized");

    // Work out the coordinates again only when the map link or address changed, or there are none yet.
    // A changed place whose new location can't be found loses the old (now wrong) coordinates.
    const same = (a?: string | null, b?: string | null) => (a ?? "").trim() === (b ?? "").trim();
    const placeChanged =
      !same(existing.google_maps_url, data.google_maps_url) ||
      !same(existing.address, data.address) ||
      !same(existing.city, data.city) ||
      !same(existing.state, data.state);
    const hasCoords = existing.latitude != null && existing.longitude != null;
    let coordsPatch: { latitude: number | null; longitude: number | null } | Record<string, never> = {};
    if (placeChanged || !hasCoords) {
      const coords = await resolveBusinessCoords(data, userId);
      if (coords) coordsPatch = coords;
      else if (placeChanged) coordsPatch = { latitude: null, longitude: null };
    }

    const { id, ...rest } = data;
    const patch = (slug: string) => ({
      ...rest,
      slug,
      ...coordsPatch,
      phone_secondary: rest.phone_secondary || null,
      website: rest.website || null,
      email: rest.email || null,
      instagram_url: rest.instagram_url || null,
      facebook_url: rest.facebook_url || null,
      youtube_url: rest.youtube_url || null,
      google_maps_url: rest.google_maps_url || null,
      featured_image: rest.featured_image || null,
      ...(rest.catalog_link !== undefined ? { catalog_link: rest.catalog_link || null } : {}),
      app_discount_percent:
        rest.app_discount_percent == null || Number.isNaN(rest.app_discount_percent)
          ? null
          : rest.app_discount_percent,
      app_discount_label: rest.app_discount_label ? rest.app_discount_label : null,
      app_discount_valid_until: rest.app_discount_valid_until ? rest.app_discount_valid_until : null,
    });
    // A slug that did not change is kept as it is. A new one must not collide with ANY other business (taken -> slug-2, ...).
    const slugChanged = rest.slug !== existing.slug;
    let finalSlug = existing.slug;
    let updatedRows: { id: string }[] | null = null;
    for (let attempt = 0; attempt < 3 && !updatedRows; attempt++) {
      finalSlug = slugChanged ? await uniqueBusinessSlug(rest.slug, { excludeId: id, fallbackClient: supabase }) : existing.slug;
      const { data: rows, error } = await supabase.from("businesses").update(patch(finalSlug)).eq("id", id).select("id");
      if (error) {
        if (slugChanged && isSlugConflict(error) && attempt < 2) continue;
        if (isMissingColumnError(error) && /show_(services|products)/.test(error.message ?? "")) throw new Error(SECTION_TOGGLES_NEED_MIGRATION);
        if (isMissingColumnError(error) && /catalog_link/.test(error.message ?? "")) throw new Error(CATALOG_LINK_NEEDS_MIGRATION);
        if (isCatalogNotAllowedError(error)) throw new Error(CATALOG_PLAN_MESSAGE);
        throw new Error(friendlyEditError(error, error.message));
      }
      // The database silently skips an update the row-level-security policy refuses (owner of a published
      // business with no active plan): no error, zero rows. Report it instead of pretending it saved.
      if (!rows || rows.length === 0) throw new Error(EDIT_LOCKED_MESSAGE);
      updatedRows = rows;
    }
    return { success: true, slug: finalSlug };
  });

// -------- Admin: business approval --------

export const listPendingBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const base =
      "id, name, slug, description, address, city, state, phone, phone_secondary, email, website, featured_image, status, created_at, owner_id, category_id, categories:category_id(name, slug)";
    const query = (cols: string) => supabase.from("businesses").select(cols).eq("status", "pending").order("created_at", { ascending: false });
    // contact_name / quick_lead exist once the quick-listing SQL has run; until then the list works as before.
    let res = await query(`${base}, contact_name, quick_lead`);
    if (res.error && isMissingColumnError(res.error)) res = await query(base);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;
    const photos = await photoCountsFor(supabase, rows.map((b) => b.id));
    return rows.map((b) => {
      const photoCount = photos.get(b.id) ?? 0;
      return {
        ...(b as unknown as {
          id: string; name: string; slug: string; description: string | null; address: string | null; city: string | null;
          state: string | null; phone: string | null; phone_secondary: string | null; email: string | null; website: string | null;
          featured_image: string | null; status: string; created_at: string; owner_id: string | null;
        }),
        categoryName: (b as unknown as { categories: { name: string } | null }).categories?.name ?? "",
        contactName: (b.contact_name as string | null | undefined) ?? null,
        quickLead: b.quick_lead === true,
        photoCount,
        gaps: publishGaps({ category_id: b.category_id as string | null, address: b.address as string | null, featured_image: b.featured_image as string | null, photoCount }),
      };
    });
  });

export const reviewBusinessSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    // Publishing a listing with no category, no address or no photo needs a second, deliberate confirmation.
    if (data.action === "approve" && !data.force) {
      const { data: biz, error: bizError } = await supabase
        .from("businesses")
        .select("category_id, address, featured_image")
        .eq("id", data.id)
        .maybeSingle();
      if (bizError) throw new Error(bizError.message);
      if (!biz) throw new Error("Business not found");
      const photoCount = (await photoCountsFor(supabase, [data.id])).get(data.id) ?? 0;
      const gaps = publishGaps({ category_id: biz.category_id, address: biz.address, featured_image: biz.featured_image, photoCount });
      if (gaps.length > 0) return { success: false as const, needsConfirm: true as const, gaps };
    }

    const newStatus = data.action === "approve" ? "published" : "rejected";
    const { error } = await supabase.from("businesses").update({ status: newStatus }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true as const, needsConfirm: false as const, status: newStatus };
  });

// -------- Admin: verified toggle --------

export const adminListPublishedBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, city, phone, phone_secondary, email, verified, created_at, categories:category_id(name)")
      .eq("status", "published")
      .order("verified", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      city: b.city,
      phone: b.phone,
      phoneSecondary: b.phone_secondary,
      email: b.email,
      verified: b.verified,
      created_at: b.created_at,
      categoryName: (b as unknown as { categories: { name: string } | null }).categories?.name ?? "",
    }));
  });

export const adminSetVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const { error } = await supabase
      .from("businesses")
      .update({ verified: data.verified })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminListAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, event_type, actor_id, target_user_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      event_type: row.event_type,
      actor_id: row.actor_id,
      target_user_id: row.target_user_id,
      details: JSON.stringify(row.details ?? {}),
      created_at: row.created_at,
    }));
  });

export const adminGetStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const [
      { count: totalBusinesses },
      { count: publishedBusinesses },
      { count: pendingBusinesses },
      { count: verifiedBusinesses },
      { count: totalCategories },
      { count: totalReviews },
      { count: totalClaims },
      { count: activeBanners },
      { count: totalRoles },
    ] = await Promise.all([
      supabase.from("businesses").select("id", { count: "exact", head: true }),
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("verified", true),
      supabase.from("categories").select("id", { count: "exact", head: true }),
      supabase.from("business_reviews").select("id", { count: "exact", head: true }),
      supabase.from("discount_claims").select("id", { count: "exact", head: true }),
      supabase.from("banner_ads").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("user_roles").select("id", { count: "exact", head: true }),
    ]);

    return {
      totalBusinesses: totalBusinesses ?? 0,
      publishedBusinesses: publishedBusinesses ?? 0,
      pendingBusinesses: pendingBusinesses ?? 0,
      verifiedBusinesses: verifiedBusinesses ?? 0,
      totalCategories: totalCategories ?? 0,
      totalReviews: totalReviews ?? 0,
      totalClaims: totalClaims ?? 0,
      activeBanners: activeBanners ?? 0,
      totalRoles: totalRoles ?? 0,
    };
  });

const reviewSchema = z.object({
  businessId: z.string().uuid(),
  rating: z.coerce.number().min(1).max(5),
  review: z.string().max(1000).optional(),
});

export const addReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("business_reviews").insert({
      business_id: data.businessId,
      user_id: context.userId,
      rating: data.rating,
      review: data.review || null,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

const claimSchema = z.object({
  businessId: z.string().uuid(),
  message: z.string().max(1000).optional(),
});

export const submitClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => claimSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("business_claims").insert({
      business_id: data.businessId,
      user_id: context.userId,
      message: data.message || null,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "business_owner" }),
    ]);

    const baseCols =
      "id, name, slug, status, city, phone, phone_secondary, category_id, current_plan_id, plan_tier_order, plans:current_plan_id(name, slug, analytics_access), categories:category_id(name, slug)";
    const buildQuery = (cols: string) => {
      let q = supabase.from("businesses").select(cols).order("created_at", { ascending: false });
      if (!isAdmin) q = q.eq("owner_id", userId);
      return q;
    };
    // quick_lead & co exist once the quick-listing SQL has run; until then the dashboard works as before.
    // The businesses and the claims are independent: ask for both at once.
    let claimsQuery = supabase
      .from("business_claims")
      .select("id, business_id, user_id, status, message, created_at, businesses:business_id(name, slug, city)")
      .order("created_at", { ascending: false });
    if (!isAdmin) {
      claimsQuery = claimsQuery.eq("user_id", userId);
    }
    let [businessesRes, claimsRes] = await Promise.all([
      buildQuery(`${baseCols}, quick_lead, contact_name, address, description, hours, featured_image`),
      claimsQuery,
    ]);
    if (businessesRes.error && isMissingColumnError(businessesRes.error)) businessesRes = await buildQuery(baseCols);
    const businesses = businessesRes.data;
    const businessesError = businessesRes.error;
    if (businessesError) throw new Error(businessesError.message);
    const claims = claimsRes.data;
    const claimsError = claimsRes.error;
    if (claimsError) throw new Error(claimsError.message);

    // Which of the owner's businesses are locked for editing (published, no active plan). Admins are never locked.
    // Fails open if business_owner_can_edit is not installed yet.
    const lockedIds = new Set<string>();
    if (!isAdmin) {
      await Promise.all(
        (businesses ?? []).map(async (b) => {
          const id = (b as unknown as { id: string }).id;
          const { data: canEdit, error: canEditError } = await supabase.rpc("business_owner_can_edit", {
            _business_id: id,
          });
          if (!canEditError && canEdit === false) lockedIds.add(id);
        }),
      );
    }

    // Quick leads (owner view): has a plan been activated yet? If not, they wait; if so, they complete their details.
    type Quick = { quick_lead?: boolean; address?: string | null; description?: string | null; hours?: unknown; featured_image?: string | null; category_id?: string | null };
    const planActive = new Map<string, boolean>();
    const photos = new Map<string, number>();
    const quickIds = (businesses ?? [])
      .filter((b) => (b as unknown as Quick).quick_lead === true)
      .map((b) => (b as unknown as { id: string }).id);
    if (quickIds.length > 0) {
      await Promise.all(
        quickIds.map(async (id) => {
          const { data: active, error: activeError } = await supabase.rpc("business_has_active_plan" as never, { _business_id: id } as never);
          // If the function is not installed, fall back to the edit lock (a quick lead without a plan is locked).
          planActive.set(id, activeError ? !lockedIds.has(id) : (active as unknown) === true);
        }),
      );
      for (const [id, n] of await photoCountsFor(supabase, quickIds)) photos.set(id, n);
    }

    const typedBusinesses = (businesses ?? []).map((b) => ({
      quickLead: (b as unknown as Quick).quick_lead === true,
      contactName: (b as unknown as { contact_name?: string | null }).contact_name ?? null,
      // Owner view only: a quick lead whose plan is not active yet shows "Waiting for activation".
      waitingActivation: !isAdmin && (b as unknown as Quick).quick_lead === true && planActive.get((b as unknown as { id: string }).id) !== true,
      checklist:
        !isAdmin && (b as unknown as Quick).quick_lead === true && planActive.get((b as unknown as { id: string }).id) === true
          ? completionChecklist({ ...(b as unknown as Quick), photoCount: photos.get((b as unknown as { id: string }).id) ?? 0 })
          : null,
      editLocked: lockedIds.has((b as unknown as { id: string }).id),
      id: (b as unknown as { id: string }).id,
      name: (b as unknown as { name: string }).name,
      slug: (b as unknown as { slug: string }).slug,
      status: (b as unknown as { status: string }).status,
      city: (b as unknown as { city: string | null }).city,
      phone: (b as unknown as { phone: string | null }).phone,
      phoneSecondary: (b as unknown as { phone_secondary: string | null }).phone_secondary,
      categoryName: (b as unknown as { categories: { name: string } | null }).categories?.name ?? "",
      planName: (b as unknown as { plans: { name: string } | null }).plans?.name ?? null,
      planTierOrder: (b as unknown as { plan_tier_order: number }).plan_tier_order ?? 0,
      analyticsAccess: !!(b as unknown as { plans: { analytics_access: boolean } | null }).plans?.analytics_access,
    }));

    const typedClaims = (claims ?? []).map((c) => ({
      id: (c as unknown as { id: string }).id,
      status: (c as unknown as { status: string }).status,
      message: (c as unknown as { message: string | null }).message,
      businessName: (c as unknown as { businesses: { name: string } | null }).businesses?.name ?? "",
    }));

    return { businesses: typedBusinesses, claims: typedClaims, isAdmin: !!isAdmin, isOwner: !!isOwner };
  });

export const updateClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ claimId: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const { data: claim } = await supabase
      .from("business_claims")
      .select("business_id, user_id")
      .eq("id", data.claimId)
      .single();
    if (!claim) throw new Error("Claim not found");

    const { error } = await supabase
      .from("business_claims")
      .update({ status: data.status })
      .eq("id", data.claimId);
    if (error) throw new Error(error.message);

    if (data.status === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("businesses")
        .update({ owner_id: claim.user_id })
        .eq("id", claim.business_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: claim.user_id, role: "business_owner" }).select();
    }

    return { success: true };
  });

// -------- Archive / restore / permanent delete (admin only) --------
// Businesses are never hard-deleted from the app any more: deleting a business also deletes its subscriptions and
// payment history (ON DELETE CASCADE). "Archived" hides it everywhere public and keeps every row.

async function requireAdmin(context: { supabase: ReturnType<typeof createServerSupabaseClient>; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Unauthorized");
}

/** Every business with its status, for the admin "Businesses" tab (published, pending, rejected, archived). */
export const adminListAllBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as never);
    const base =
      "id, name, slug, city, phone, phone_secondary, email, status, verified, created_at, category_id, address, featured_image, owner_id, categories:category_id(name), plans:current_plan_id(name)";
    const query = (cols: string) => context.supabase.from("businesses").select(cols).order("created_at", { ascending: false }).limit(2000);
    // lead_source exists once supabase/pending/quick-add has run, contact_name / quick_lead once quick-listing has: fall back step by step.
    let res = await query(`${base}, contact_name, quick_lead, lead_source`);
    if (res.error && isMissingColumnError(res.error)) res = await query(`${base}, contact_name, quick_lead`);
    if (res.error && isMissingColumnError(res.error)) res = await query(base);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as unknown as Array<{
      id: string; name: string; slug: string; city: string | null; phone: string | null; phone_secondary: string | null;
      email: string | null; status: string; verified: boolean; created_at: string; category_id: string | null;
      address: string | null; featured_image: string | null; owner_id: string | null; contact_name?: string | null; quick_lead?: boolean; lead_source?: string | null;
      categories: { name: string } | null; plans: { name: string } | null;
    }>;
    // Photo counts only for the leads that are still pending (that is where the warning is shown).
    const pendingIds = rows.filter((b) => b.status === "pending").map((b) => b.id);
    const photos = await photoCountsFor(context.supabase, pendingIds);
    // Who owns each business, as an e-mail (service client, admin-only function). If it cannot be read the list still works.
    let ownerEmails = new Map<string, string>();
    try {
      ownerEmails = await authEmailsByIds([...new Set(rows.map((b) => b.owner_id).filter((id): id is string => !!id))]);
    } catch (e) {
      console.error("[adminListAllBusinesses] owner e-mails unavailable", e);
    }
    return rows.map((b) => ({
      ownerId: b.owner_id,
      ownerEmail: b.owner_id ? ownerEmails.get(b.owner_id) ?? null : null,
      id: b.id,
      name: b.name,
      slug: b.slug,
      city: b.city,
      phone: b.phone,
      phoneSecondary: b.phone_secondary,
      email: b.email,
      status: b.status,
      verified: b.verified,
      created_at: b.created_at,
      categoryName: b.categories?.name ?? "",
      planName: b.plans?.name ?? null,
      contactName: b.contact_name ?? null,
      quickLead: b.quick_lead === true,
      leadSource: b.lead_source ?? null,
      gaps: publishGaps({ category_id: b.category_id, address: b.address, featured_image: b.featured_image, photoCount: photos.get(b.id) ?? 0 }),
    }));
  });

const adminQuickAddSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name").max(120),
  contactName: z.string().trim().min(2, "Enter the contact person's name").max(80),
  phone: z.string().trim().max(30).refine(isValidIndianMobile, PHONE_ERROR),
  categoryId: z.string().uuid("Choose a category"),
  city: z.string().trim().min(1, "Choose the city").max(120),
  source: z.string().trim().max(120).nullable().optional(),
  /** true = the admin saw the "this phone already exists" warning and chose to save anyway. */
  force: z.boolean().optional(),
});

/**
 * Admin "Quick add" (leads collected at an event). Creates the business exactly like the owner quick listing: pending, quick_lead,
 * contact name, phone, unique slug; the admin is the owner for now. A phone number that already belongs to a business is NOT saved
 * unless `force` is set: the existing business is returned instead so the admin can look at it.
 */
export const adminQuickAddBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adminQuickAddSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const supabase = context.supabase;

    if (!data.force) {
      const { data: existing, error: existingError } = await supabase
        .from("businesses")
        .select("id, name, slug, city, status, phone, phone_secondary")
        .limit(5000);
      if (existingError) throw new Error(existingError.message);
      const dup = findPhoneDuplicate(existing ?? [], data.phone);
      if (dup) {
        return {
          saved: null,
          sourceSaved: true,
          duplicate: { id: dup.id, name: dup.name, slug: dup.slug, city: dup.city, status: dup.status, phone: dup.phone ?? dup.phone_secondary },
        };
      }
    }

    const base = ensureSlug(data.name);
    const source = data.source?.trim() || null;
    let sourceSaved = true;
    let saved: { id: string; slug: string; name: string } | null = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      const slug = await uniqueBusinessSlug(base, { fallbackClient: supabase });
      const row: TablesInsert<"businesses"> = {
        name: data.name,
        slug,
        city: data.city,
        phone: data.phone,
        contact_name: data.contactName,
        category_id: data.categoryId,
        owner_id: context.userId,
        status: "pending",
        quick_lead: true,
      };
      if (source && sourceSaved) row.lead_source = source;
      let res = await supabase.from("businesses").insert(row).select("id, slug, name").single();
      if (res.error && source && sourceSaved && isMissingColumnError(res.error)) {
        // supabase/pending/quick-add has not been run yet: save the lead without its source and say so.
        sourceSaved = false;
        delete row.lead_source;
        res = await supabase.from("businesses").insert(row).select("id, slug, name").single();
      }
      if (!res.error) {
        saved = res.data;
      } else if (isMissingColumnError(res.error) || res.error.code === "23502") {
        throw new Error(QUICK_NEEDS_MIGRATION);
      } else if (!isSlugConflict(res.error) || attempt === 2) {
        throw new Error(res.error.message);
      }
    }
    if (!saved) throw new Error("Could not save the lead. Please try again.");
    return { saved, sourceSaved: !source || sourceSaved, duplicate: null };
  });

/** The last few quick leads (newest first) for the list under the Quick add form. */
export const adminRecentQuickLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as never);
    const query = (cols: string) =>
      context.supabase.from("businesses").select(cols).eq("quick_lead", true).order("created_at", { ascending: false }).limit(5);
    let res = await query("id, name, contact_name, phone, city, created_at, lead_source, categories:category_id(name)");
    if (res.error && isMissingColumnError(res.error)) res = await query("id, name, contact_name, phone, city, created_at, categories:category_id(name)");
    if (res.error) {
      // quick-listing SQL not applied yet: no quick leads exist.
      if (isMissingColumnError(res.error)) return [];
      throw new Error(res.error.message);
    }
    return ((res.data ?? []) as unknown as Array<{
      id: string; name: string; contact_name: string | null; phone: string | null; city: string | null; created_at: string;
      lead_source?: string | null; categories: { name: string } | null;
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      contactName: r.contact_name,
      phone: r.phone,
      city: r.city,
      createdAt: r.created_at,
      leadSource: r.lead_source ?? null,
      categoryName: r.categories?.name ?? "",
    }));
  });

const NO_ACCOUNT_MESSAGE = "No account with this email – ask the client to sign up first.";

/** Admin: find the sign-in account for an e-mail (step 1 of "Assign owner"; the dialog then asks for confirmation). */
export const adminLookupOwnerByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    let user: { id: string; email: string } | null = null;
    try {
      user = await findAuthUserByEmail(data.email);
    } catch (e) {
      console.error("[adminLookupOwnerByEmail] lookup failed", e);
      throw new Error("Could not look up accounts right now. Please try again.");
    }
    if (!user) throw new Error(NO_ACCOUNT_MESSAGE);
    return { userId: user.id, email: user.email };
  });

/**
 * Admin: make `userId` the owner of a business (step 2, after the admin confirmed the business name and the new owner e-mail).
 * Only businesses.owner_id changes: subscriptions, plan and everything else stay attached to the business. The new owner gets the
 * business_owner role if missing, and an in-app notification.
 */
export const adminAssignBusinessOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ businessId: z.string().uuid(), userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: biz, error: bizError }, { data: userRes, error: userError }] = await Promise.all([
      context.supabase.from("businesses").select("id, name, slug, owner_id, plans:current_plan_id(name)").eq("id", data.businessId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(data.userId),
    ]);
    if (bizError) throw new Error(bizError.message);
    if (!biz) throw new Error("Business not found");
    const newOwner = userRes?.user;
    if (userError || !newOwner) throw new Error(NO_ACCOUNT_MESSAGE);
    if (biz.owner_id === data.userId) throw new Error("This person already owns this business.");

    // Runs as the admin: the row policy and the guard trigger both let only an admin change owner_id.
    const { data: updated, error } = await context.supabase.from("businesses").update({ owner_id: data.userId }).eq("id", data.businessId).select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) throw new Error("The database did not change the owner.");

    // The new owner needs the owner role (same as when a claim is approved). Best effort: a duplicate is fine.
    try {
      const { data: hasRole } = await supabaseAdmin.from("user_roles").select("user_id").eq("user_id", data.userId).eq("role", "business_owner").limit(1);
      if (!hasRole || hasRole.length === 0) await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "business_owner" });
    } catch (e) {
      console.error("[adminAssignBusinessOwner] could not add business_owner role", e);
    }

    // In-app notification. Never fails the transfer.
    const planName = (biz as unknown as { plans: { name: string } | null }).plans?.name ?? "none";
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: data.userId,
        type: "business_assigned",
        title: `${biz.name} is now linked to your account`,
        body: `${biz.name} is now linked to your account. Plan: ${planName}`,
        link_url: "/dashboard",
        entity_type: "business",
        entity_id: data.businessId,
      });
    } catch (e) {
      console.error("[adminAssignBusinessOwner] notification failed", e);
    }
    return { ok: true as const, ownerEmail: newOwner.email ?? null, planName };
  });

/** Archive (hide everywhere public) or restore (back to 'published'). Nothing is deleted either way. */
export const adminSetBusinessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), status: z.enum(["archived", "published"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    // Archive only a business that is not archived yet; restore only an archived one.
    const query = context.supabase.from("businesses").update({ status: data.status }).eq("id", data.id);
    const { data: rows, error } = await (data.status === "archived" ? query.neq("status", "archived") : query.eq("status", "archived")).select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(data.status === "archived" ? "Business is already archived" : "Only an archived business can be restored");
    return { success: true, status: data.status };
  });

/** What a permanent delete would take with it, for the confirm dialog. */
export const adminBusinessDeleteImpact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { data: subs, error } = await context.supabase
      .from("business_subscriptions" as never)
      .select("id, amount_paid")
      .eq("business_id", data.id);
    if (error) throw new Error(error.message);
    const rows = (subs ?? []) as unknown as Array<{ id: string; amount_paid: number | null }>;
    return { subscriptions: rows.length, totalPaid: rows.reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0) };
  });

/**
 * Permanent delete. Admin only, only for an ARCHIVED business, and only when the exact business name is sent back
 * (the admin typed it in the confirm dialog). Also deletes its subscriptions, payments, reviews, photos, products, ...
 */
export const adminDeleteBusinessPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), confirmName: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { data: biz, error: findError } = await context.supabase
      .from("businesses")
      .select("id, name, status")
      .eq("id", data.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!biz) throw new Error("Business not found");
    if (biz.status !== "archived") throw new Error("Archive the business first. Only an archived business can be deleted permanently.");
    if (data.confirmName !== biz.name) throw new Error("The name you typed does not match the business name exactly.");
    const { data: deleted, error } = await context.supabase.from("businesses").delete().eq("id", data.id).select("id");
    if (error) throw new Error(error.message);
    // Row-level security silently skips a delete it does not allow (e.g. before no-hard-delete/01_migration.sql is applied
    // it is allowed; after it, only admins): report instead of pretending it worked.
    if (!deleted || deleted.length === 0) throw new Error("The database did not delete the business.");
    return { success: true };
  });

export const getBusinessForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    // Old data can hold two businesses with one slug: take the caller's own (an admin: the oldest) instead of failing
    // with "multiple rows". No match at all is a normal not-found page. The role check and the lookup run at once.
    const [{ data: isAdmin }, { data: found, error }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      supabase
        .from("businesses")
        .select("*, categories:category_id(id, name, slug, color, icon)")
        .eq("slug", data.slug)
        .order("created_at", { ascending: true })
        .limit(10),
    ]);
    if (error) throw new Error(error.message);
    if (!found || found.length === 0) throw notFound();
    const business = found.find((b) => b.owner_id === context.userId) ?? found[0];
    if (business.owner_id !== context.userId && !isAdmin) throw new Error("Unauthorized");

    // Photos and the two plan checks are independent: all at once. Owner of a published business without an active plan: the
    // edit form is replaced by a "plan needed" card. The database is the source of truth (business_owner_can_edit); if that
    // function is not installed yet the check is skipped (fails open) and the page behaves as before. The catalog (PDF) is only
    // for plans that allow it (admins always can); if business_can_use_catalog is not installed yet the owner keeps the uploader.
    const [{ data: photos }, canEditRes, canCatalogRes] = await Promise.all([
      supabase.from("business_photos").select("*").eq("business_id", business.id).order("display_order", { ascending: true }),
      isAdmin ? Promise.resolve(null) : supabase.rpc("business_owner_can_edit", { _business_id: business.id }),
      isAdmin ? Promise.resolve(null) : supabase.rpc("business_can_use_catalog", { _business_id: business.id }),
    ]);
    const editLocked = !!canEditRes && !canEditRes.error && canEditRes.data === false;
    const catalogAllowed = canCatalogRes ? (canCatalogRes.error ? true : canCatalogRes.data === true) : true;

    return { business, photos: photos ?? [], editLocked, catalogAllowed };
  });

// -------- Category / City landing page data --------

const DIRECTORY_TTL_MS = 60_000;

/** Every published business (only what the directory map needs), in pages of 1000: the database caps one answer at 1000 rows. */
async function fetchPublishedRows(): Promise<DirectoryRow[]> {
  const supabase = createServerSupabaseClient();
  const out: DirectoryRow[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase
      .from("businesses")
      .select("slug, city, category_id, updated_at")
      .eq("status", "published")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as DirectoryRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

/**
 * The map of the directory (which cities / categories have businesses, how many): one cached answer (a minute) for the landing
 * pages and their links. `categories` are the full category rows, also those that have no business yet.
 */
async function loadDirectory(): Promise<{ dir: Directory; categories: Array<DirectoryCategory & Record<string, unknown>> }> {
  return cachedFor("directory", DIRECTORY_TTL_MS, async () => {
    const supabase = createServerSupabaseClient();
    const [rows, catRes] = await Promise.all([fetchPublishedRows(), supabase.from("categories").select("*")]);
    if (catRes.error) throw new Error(catRes.error.message);
    const categories = (catRes.data ?? []) as unknown as Array<DirectoryCategory & Record<string, unknown>>;
    return { dir: buildDirectory(rows, categories), categories };
  });
}

const BUSINESS_LIST_COLUMNS =
  "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, categories:category_id!inner(id, name, slug, color), business_reviews(rating)";

export const getCategoryPageData = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const [{ dir, categories }, { data: businesses, error }] = await Promise.all([
      loadDirectory(),
      supabase
        .from("businesses")
        .select(BUSINESS_LIST_COLUMNS)
        .eq("status", "published")
        .eq("categories.slug", data.slug)
        .order("plan_tier_order", { ascending: false })
        .order("plan_featured", { ascending: false })
        .order("verified", { ascending: false })
        .order("name", { ascending: true })
        .limit(60),
    ]);
    const category = categories.find((c) => c.slug === data.slug);
    if (!category) throw new Error("Category not found");
    if (error) throw new Error(error.message);

    const listings = withRatingSummary(businesses);
    const entry = dir.categories.get(data.slug);
    return {
      // The row as it always was (the page and the admin read the same columns).
      category: category as unknown as Tables<"categories">,
      businesses: listings,
      /** Its cities with the number of businesses in each (every city that has one), most first. */
      cityLinks: entry?.cities ?? [],
      /** Exact number of published businesses in this category (the list holds at most 60). */
      total: Math.max(entry?.count ?? 0, listings.length),
      keywords: (category.seo_keywords as string | null | undefined) ?? null,
    };
  });

export const getCityPageData = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const slug = citySlug(data.slug);
    const { dir } = await loadDirectory();
    const entry = dir.cities.get(slug);
    // A city that no published business uses: an empty page (noindex), named from its address part.
    if (!entry) return { cityName: prettySlug(slug), citySlug: slug, businesses: [], total: 0, categories: [] as CategoryLink[] };

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, categories:category_id(id, name, slug, color), business_reviews(rating)",
      )
      .eq("status", "published")
      .in("city", entry.variants)
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(80);
    if (error) throw new Error(error.message);
    const listings = withRatingSummary(businesses);
    return {
      cityName: entry.name,
      citySlug: slug,
      businesses: listings,
      total: Math.max(entry.count, listings.length),
      /** ALL its categories with their number of businesses (not only the ones among the 80 listed). */
      categories: entry.categories,
    };
  });

export const getRelatedBusinesses = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({
      businessId: z.string().uuid(),
      categoryId: z.string().uuid().nullable().optional(),
      city: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    let query = supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .neq("id", data.businessId)
      .limit(6);
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.city) query = query.ilike("city", data.city);
    const { data: businesses, error } = await query
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return businesses ?? [];
  });

export const getCityCategoryPageData = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ city: z.string(), category: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const slug = citySlug(data.city);
    const { dir, categories } = await loadDirectory();
    const category = categories.find((c) => c.slug === data.category);
    if (!category) throw new Error("Category not found");
    const entry = dir.cities.get(slug);
    const cityName = entry?.name ?? prettySlug(slug);
    const keywords = (category.seo_keywords as string | null | undefined) ?? null;
    const categoryRow = category as unknown as Tables<"categories">;
    // A pair with no business (or a city nobody uses): an empty page (noindex), and not a database query.
    const pair = entry?.categories.find((c) => c.slug === data.category);
    // Links to neighbouring landing pages (every one of them has at least one business).
    const otherCategories = (entry?.categories ?? []).filter((c) => c.slug !== data.category).slice(0, 10);
    const otherCities = (dir.categories.get(data.category)?.cities ?? []).filter((c) => c.slug !== slug).slice(0, 10);
    if (!entry || !pair) return { cityName, citySlug: slug, category: categoryRow, businesses: [], total: 0, keywords, otherCategories, otherCities };

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select(BUSINESS_LIST_COLUMNS)
      .eq("status", "published")
      .eq("categories.slug", data.category)
      .in("city", entry.variants)
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(80);
    if (error) throw new Error(error.message);
    const listings = withRatingSummary(businesses);
    return { cityName, citySlug: slug, category: categoryRow, businesses: listings, total: Math.max(pair.count, listings.length), keywords, otherCategories, otherCities };
  });

/** For /sitemap.xml: only pages that have at least one published business, each with the date its content last changed. */
export const getSitemapData = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const [rows, { data: categoryRows }] = await Promise.all([fetchPublishedRows(), supabase.from("categories").select("id, name, slug")]);
  const dir = buildDirectory(rows, (categoryRows ?? []) as DirectoryCategory[]);
  return {
    businesses: rows.map((r) => ({ slug: r.slug, updated_at: r.updated_at })),
    categories: [...dir.categories.values()].map((c) => ({ slug: c.slug, lastmod: c.lastmod })),
    cities: [...dir.cities.values()].map((c) => ({ slug: c.slug, lastmod: c.lastmod })),
    combos: dir.combos.map((c) => ({ city: c.city, category: c.category, lastmod: c.lastmod })),
  };
});

// -------- App-exclusive discount claims --------

function generateClaimCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `KH-${out}`;
}

export const claimDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select("id, app_discount_percent, app_discount_valid_until")
      .eq("id", data.businessId)
      .eq("status", "published")
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!business || !business.app_discount_percent || business.app_discount_percent <= 0) {
      throw new Error("No active discount for this business.");
    }
    if (business.app_discount_valid_until) {
      const today = new Date().toISOString().slice(0, 10);
      if (business.app_discount_valid_until < today) {
        throw new Error("This discount has expired.");
      }
    }
    const code = generateClaimCode();
    const { error } = await supabase.from("discount_claims").insert({
      business_id: business.id,
      user_id: userId,
      code,
      discount_percent: business.app_discount_percent,
    });
    if (error) throw new Error(error.message);
    return { code, discountPercent: business.app_discount_percent };
  });

export const listBusinessDiscountClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("discount_claims")
      .select("id, code, discount_percent, claimed_at")
      .eq("business_id", data.businessId)
      .order("claimed_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().min(1).max(50).optional().default(12),
});

// Businesses within 25 km; if that gives fewer than 4, the search widens to 50 km (see rankNearby).
export const getNearbyBusinesses = createServerFn({ method: "GET" })
  .inputValidator((input) => nearbySchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const { lat, lng, limit } = data;
    // One query for the wide box; the radius is applied below. ~1 deg latitude ≈ 111km; longitude varies with cos(lat)
    const latDelta = NEARBY_WIDE_RADIUS_KM / 111;
    const lngDelta = NEARBY_WIDE_RADIUS_KM / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    // (NEARBY_* constants and rankNearby live in ./nearby.ts)

    const { data: rows, error } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, state, phone, verified, plan_tier_order, featured_image, hours, status, app_discount_percent, app_discount_label, app_discount_valid_until, latitude, longitude, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", lat - latDelta)
      .lte("latitude", lat + latDelta)
      .gte("longitude", lng - lngDelta)
      .lte("longitude", lng + lngDelta)
      .limit(500);
    if (error) throw new Error(error.message);

    return rankNearby(rows ?? [], lat, lng, limit);
  });
