import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";
import { slugify, ensureSlug } from "./slug";
import { isValidIndianMobile, PHONE_ERROR } from "./phone";
import { optionalUrl, requiredUrl, WEBSITE_ERROR, SOCIAL_ERROR, MAPS_ERROR } from "./url";
import { EDIT_LOCKED_MESSAGE, friendlyEditError } from "./edit-lock";
import { compareCategoryName } from "./category-sort";
import { canonicalCityName } from "./geolocation";
import { resolveCoords } from "./coords.server";
import { cityKey } from "./places";
import { NEARBY_WIDE_RADIUS_KM, rankNearby } from "./nearby";
import cityCentres from "@/data/city-coords.json";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["relevance", "rating", "newest", "discount"]).optional().default("relevance"),
  hasDiscount: z.coerce.boolean().optional().default(false),
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
        "id, name, slug, description, address, city, state, phone, verified, plan_tier_order, featured_image, hours, status, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id!inner(id, name, slug, color), business_reviews(rating)",
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

    if (data.hasDiscount) {
      const today = new Date().toISOString().slice(0, 10);
      query = query
        .gt("app_discount_percent", 0)
        .or(`app_discount_valid_until.is.null,app_discount_valid_until.gte.${today}`);
    }

    // The order is decided in the database so every page continues exactly where the last one stopped:
    //   relevance: plan priority, featured, verified, name;  newest: newest first;  discount: biggest discount first.
    // `id` is the last tie-breaker, so two businesses can never swap places between pages (no duplicates, none skipped).
    // "rating" and a minimum rating need the reviews of every match, so that mode loads all matches (the database caps
    // a response at 1000 rows) and sorts / pages them here.
    const inMemory = data.sort === "rating" || (data.minRating ?? 0) > 0;
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

    let results = (businesses ?? []).map(({ business_reviews, ...b }) => {
      const reviews = business_reviews ?? [];
      const sum = reviews.reduce((total, r) => total + r.rating, 0);
      return {
        ...b,
        avgRating: reviews.length ? Number((sum / reviews.length).toFixed(1)) : 0,
        reviewCount: reviews.length,
      };
    });

    let total = count ?? results.length;
    if (inMemory) {
      if ((data.minRating ?? 0) > 0) results = results.filter((b) => b.avgRating >= data.minRating!);
      // Array.sort is stable: equal ratings keep the plan-priority order above.
      if (data.sort === "rating") results = [...results].sort((a, b) => b.avgRating - a.avgRating);
      total = results.length;
      results = results.slice(offset, offset + data.limit);
    }

    return {
      items: results,
      /** How many businesses match in total (not just on this page). */
      total,
      page: data.page,
      hasMore: offset + results.length < total,
    };
  });

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

    const { data: business, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
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

    const { data: reviews } = await supabase
      .from("business_reviews")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    const userIds = [...new Set((reviews ?? []).map((r) => r.user_id))];
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      for (const p of profileRows ?? []) {
        profiles[p.user_id] = p;
      }
    }

    const reviewsWithProfiles = (reviews ?? []).map((r) => ({
      ...r,
      profiles: profiles[r.user_id] ?? null,
    }));

    const { data: photos } = await supabase
      .from("business_photos")
      .select("*")
      .eq("business_id", business.id)
      .order("display_order", { ascending: true });

    const avgRating =
      reviews && reviews.length > 0
        ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
        : 0;

    // Show the catalog only while the business's active plan includes it. Nothing is deleted: the file and the
    // saved values stay, they just are not shown. Fails open (shown, as before) if the database function is missing.
    let catalogAllowed = true;
    if (business.catalog_url) {
      const { data: canCatalog, error: canCatalogError } = await supabase.rpc("business_can_use_catalog", {
        _business_id: business.id,
      });
      catalogAllowed = canCatalogError ? true : canCatalog === true;
    }

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
    if (error) throw new Error(error.message);
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
});

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

    const { data: updated, error } = await context.supabase
      .from("categories")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
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

export const getBannerAdsForCity = createServerFn({ method: "GET" })
  // `all` = the person explicitly chose "All locations": every active banner, whatever its city.
  .inputValidator((input) =>
    z.object({ city: z.string().trim().min(1).max(80).optional(), all: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    // Only show banners for the selected city. If no city is selected AND "All locations" was not chosen,
    // return nothing so city-specific banners don't leak across locations.
    if (!data.city && !data.all) return [];
    const now = new Date().toISOString();
    let query = supabase
      .from("banner_ads")
      .select("id, business_id, title, subtitle, image_url, mobile_image_url, cta_label, cta_url, city, priority")
      .is("category_id", null)
      .eq("active", true)
      .lte("start_at", now)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    // With a city: exactly that city. With "All locations": no city condition at all (never an empty-string match).
    if (data.city) query = query.ilike("city", exactIlike(data.city));
    const { data: banners, error } = await query;
    if (error) throw new Error(error.message);
    return (banners ?? []).map((banner) => ({
      ...banner,
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
    const { data: banners, error } = await query
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (banners ?? []).map((banner) => ({
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
});

export const adminListBannerAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("banner_ads")
      .select("*")
      .order("city", { ascending: true })
      .order("priority", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateBannerAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bannerInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: inserted, error } = await context.supabase
      .from("banner_ads")
      .insert({
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
    const { id, ...rest } = data;
    const { data: updated, error } = await context.supabase
      .from("banner_ads")
      .update({
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

export const getHomeData = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ city: z.string().optional() }).optional().parse(input) ?? {},
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const city = data?.city?.trim();
    let featuredQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)")
      .eq("status", "published")
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .limit(8);
    if (city) featuredQuery = featuredQuery.ilike("city", city);

    // Platinum spotlight: Platinum (4) & Enterprise (5) only — the auto-showcase perk
    let spotlightQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)")
      .eq("status", "published")
      .gte("plan_tier_order", 4)
      .order("plan_tier_order", { ascending: false })
      .order("verified", { ascending: false })
      .limit(8);
    if (city) spotlightQuery = spotlightQuery.ilike("city", city);

    const today = new Date().toISOString().slice(0, 10);
    let offersQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)")
      .eq("status", "published")
      .gt("app_discount_percent", 0)
      .or(`app_discount_valid_until.is.null,app_discount_valid_until.gte.${today}`)
      .order("app_discount_percent", { ascending: false })
      .limit(8);
    if (city) offersQuery = offersQuery.ilike("city", city);

    // Popular Categories are ranked by published businesses: in the selected city first, then (to fill the
    // tiles) overall. Two count queries run in parallel with the rest — never one query per category.
    const [
      { data: allCategories },
      { data: featured },
      { data: offers },
      { data: spotlight },
      cityCounts,
      overallCounts,
    ] = await Promise.all([
      supabase.from("categories").select("*").order("display_order", { ascending: true }),
      featuredQuery,
      offersQuery,
      spotlightQuery,
      city ? countPublishedByCategory(supabase, city) : Promise.resolve(null),
      countPublishedByCategory(supabase),
    ]);
    const categories = rankPopularCategories(allCategories ?? [], cityCounts, overallCounts, HOME_CATEGORY_TILES);

  const businessIds = Array.from(
    new Set([
      ...(featured ?? []).map((b) => b.id),
      ...(offers ?? []).map((b) => b.id),
      ...(spotlight ?? []).map((b) => b.id),
    ]),
  );
  let ratings = new Map<string, { count: number; sum: number }>();
  if (businessIds.length > 0) {
    const { data: counts } = await supabase
      .from("business_reviews")
      .select("business_id, rating")
      .in("business_id", businessIds);
    for (const r of counts ?? []) {
      const entry = ratings.get(r.business_id) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += r.rating;
      ratings.set(r.business_id, entry);
    }
  }

  const listings = (featured ?? []).map((b) => {
    const rating = ratings.get(b.id);
    return {
      ...b,
      avgRating: rating ? Number((rating.sum / rating.count).toFixed(1)) : 0,
      reviewCount: rating?.count ?? 0,
    };
  });

    const topOffers = (offers ?? []).map((b) => {
      const rating = ratings.get(b.id);
      return {
        ...b,
        avgRating: rating ? Number((rating.sum / rating.count).toFixed(1)) : 0,
        reviewCount: rating?.count ?? 0,
      };
    });

    const platinumSpotlight = (spotlight ?? []).map((b) => {
      const rating = ratings.get(b.id);
      return {
        ...b,
        avgRating: rating ? Number((rating.sum / rating.count).toFixed(1)) : 0,
        reviewCount: rating?.count ?? 0,
      };
    });

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
});

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

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => businessFormSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    const coords = await resolveBusinessCoords(data, userId);

    const { data: existing, error: existingError } = await supabase
      .from("businesses")
      .select("id")
      .eq("slug", data.slug)
      .eq("city", data.city)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error("A business with this slug already exists in this city");

    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        ...data,
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
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

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
      .select("owner_id, google_maps_url, address, city, state, latitude, longitude")
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
    const { data: updatedRows, error } = await supabase
      .from("businesses")
      .update({
        ...rest,
        ...coordsPatch,
        phone_secondary: rest.phone_secondary || null,
        website: rest.website || null,
        email: rest.email || null,
        instagram_url: rest.instagram_url || null,
        facebook_url: rest.facebook_url || null,
        youtube_url: rest.youtube_url || null,
        google_maps_url: rest.google_maps_url || null,
        featured_image: rest.featured_image || null,
        app_discount_percent:
          rest.app_discount_percent == null || Number.isNaN(rest.app_discount_percent)
            ? null
            : rest.app_discount_percent,
        app_discount_label: rest.app_discount_label ? rest.app_discount_label : null,
        app_discount_valid_until: rest.app_discount_valid_until ? rest.app_discount_valid_until : null,
      })
      .eq("id", id)
      .select("id");
    if (error) throw new Error(friendlyEditError(error, error.message));
    // The database silently skips an update the row-level-security policy refuses (owner of a published
    // business with no active plan): no error, zero rows. Report it instead of pretending it saved.
    if (!updatedRows || updatedRows.length === 0) throw new Error(EDIT_LOCKED_MESSAGE);
    return { success: true };
  });

// -------- Admin: business approval --------

export const listPendingBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, state, phone, phone_secondary, email, website, featured_image, status, created_at, owner_id, categories:category_id(name, slug)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({
      ...b,
      categoryName: (b as unknown as { categories: { name: string } | null }).categories?.name ?? "",
    }));
  });

export const reviewBusinessSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");

    const newStatus = data.action === "approve" ? "published" : "rejected";
    const { error } = await supabase.from("businesses").update({ status: newStatus }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true, status: newStatus };
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

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "business_owner" });

    let businessesQuery = supabase
      .from("businesses")
      .select("id, name, slug, status, city, phone, phone_secondary, category_id, current_plan_id, plan_tier_order, plans:current_plan_id(name, slug, analytics_access), categories:category_id(name, slug)")
      .order("created_at", { ascending: false });
    if (!isAdmin) {
      businessesQuery = businessesQuery.eq("owner_id", userId);
    }
    const { data: businesses, error: businessesError } = await businessesQuery;
    if (businessesError) throw new Error(businessesError.message);

    let claimsQuery = supabase
      .from("business_claims")
      .select("id, business_id, user_id, status, message, created_at, businesses:business_id(name, slug, city)")
      .order("created_at", { ascending: false });
    if (!isAdmin) {
      claimsQuery = claimsQuery.eq("user_id", userId);
    }
    const { data: claims, error: claimsError } = await claimsQuery;
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

    const typedBusinesses = (businesses ?? []).map((b) => ({
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
    const { data, error } = await context.supabase
      .from("businesses")
      .select("id, name, slug, city, phone, phone_secondary, email, status, verified, created_at, categories:category_id(name), plans:current_plan_id(name)")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({
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
      categoryName: (b as unknown as { categories: { name: string } | null }).categories?.name ?? "",
      planName: (b as unknown as { plans: { name: string } | null }).plans?.name ?? null,
    }));
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
    const { data: business, error } = await supabase
      .from("businesses")
      .select("*, categories:category_id(id, name, slug, color, icon)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Business not found");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (business.owner_id !== context.userId && !isAdmin) throw new Error("Unauthorized");

    const { data: photos } = await supabase
      .from("business_photos")
      .select("*")
      .eq("business_id", business.id)
      .order("display_order", { ascending: true });

    // Owner of a published business without an active plan: the edit form is replaced by a "plan needed" card.
    // The database is the source of truth (business_owner_can_edit); if that function is not installed yet
    // the check is skipped (fails open) and the page behaves as before.
    let editLocked = false;
    // Catalog (PDF) is only for plans that allow it. Admins always can; if business_can_use_catalog is not
    // installed yet (error) the owner keeps the uploader, exactly as before.
    let catalogAllowed = true;
    if (!isAdmin) {
      const { data: canEdit, error: canEditError } = await supabase.rpc("business_owner_can_edit", {
        _business_id: business.id,
      });
      editLocked = !canEditError && canEdit === false;

      const { data: canCatalog, error: canCatalogError } = await supabase.rpc("business_can_use_catalog", {
        _business_id: business.id,
      });
      catalogAllowed = canCatalogError ? true : canCatalog === true;
    }

    return { business, photos: photos ?? [], editLocked, catalogAllowed };
  });

// -------- Category / City landing page data --------

export const getCategoryPageData = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const { data: category, error: catErr } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (catErr) throw new Error(catErr.message);
    if (!category) throw new Error("Category not found");

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .eq("category_id", category.id)
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);

    const ids = (businesses ?? []).map((b) => b.id);
    const ratings = new Map<string, { count: number; sum: number }>();
    if (ids.length > 0) {
      const { data: rs } = await supabase
        .from("business_reviews")
        .select("business_id, rating")
        .in("business_id", ids);
      for (const r of rs ?? []) {
        const e = ratings.get(r.business_id) ?? { count: 0, sum: 0 };
        e.count += 1;
        e.sum += r.rating;
        ratings.set(r.business_id, e);
      }
    }
    const listings = (businesses ?? []).map((b) => {
      const r = ratings.get(b.id);
      return {
        ...b,
        avgRating: r ? Number((r.sum / r.count).toFixed(1)) : 0,
        reviewCount: r?.count ?? 0,
      };
    });
    const cities = Array.from(new Set(listings.map((b) => b.city).filter(Boolean))) as string[];
    return { category, businesses: listings, cities };
  });

export const getCityPageData = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    // Slug -> pretty city name: match case-insensitive by comparing slug of stored city
    const cityName = data.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .ilike("city", `%${cityName}%`)
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(80);
    if (error) throw new Error(error.message);

    const ids = (businesses ?? []).map((b) => b.id);
    const ratings = new Map<string, { count: number; sum: number }>();
    if (ids.length > 0) {
      const { data: rs } = await supabase
        .from("business_reviews")
        .select("business_id, rating")
        .in("business_id", ids);
      for (const r of rs ?? []) {
        const e = ratings.get(r.business_id) ?? { count: 0, sum: 0 };
        e.count += 1;
        e.sum += r.rating;
        ratings.set(r.business_id, e);
      }
    }
    const listings = (businesses ?? []).map((b) => {
      const r = ratings.get(b.id);
      return {
        ...b,
        avgRating: r ? Number((r.sum / r.count).toFixed(1)) : 0,
        reviewCount: r?.count ?? 0,
      };
    });

    // Group by category for the "browse by category" section
    const byCategory = new Map<string, { name: string; slug: string; count: number }>();
    for (const b of listings) {
      const c = b.categories;
      if (!c) continue;
      const cur = byCategory.get(c.slug) ?? { name: c.name, slug: c.slug, count: 0 };
      cur.count += 1;
      byCategory.set(c.slug, cur);
    }
    return {
      cityName,
      businesses: listings,
      categories: Array.from(byCategory.values()).sort((a, b) => b.count - a.count),
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
    const cityName = data.city
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

    const { data: category, error: catErr } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", data.category)
      .maybeSingle();
    if (catErr) throw new Error(catErr.message);
    if (!category) throw new Error("Category not found");

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, description, address, city, phone, verified, plan_tier_order, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .eq("category_id", category.id)
      .ilike("city", `%${cityName}%`)
      .order("plan_tier_order", { ascending: false })
      .order("plan_featured", { ascending: false })
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(80);
    if (error) throw new Error(error.message);

    const ids = (businesses ?? []).map((b) => b.id);
    const ratings = new Map<string, { count: number; sum: number }>();
    if (ids.length > 0) {
      const { data: rs } = await supabase
        .from("business_reviews")
        .select("business_id, rating")
        .in("business_id", ids);
      for (const r of rs ?? []) {
        const e = ratings.get(r.business_id) ?? { count: 0, sum: 0 };
        e.count += 1;
        e.sum += r.rating;
        ratings.set(r.business_id, e);
      }
    }
    const listings = (businesses ?? []).map((b) => {
      const r = ratings.get(b.id);
      return {
        ...b,
        avgRating: r ? Number((r.sum / r.count).toFixed(1)) : 0,
        reviewCount: r?.count ?? 0,
      };
    });
    return { cityName, category, businesses: listings };
  });

export const getSitemapData = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const [{ data: businesses }, { data: categories }] = await Promise.all([
    supabase
      .from("businesses")
      .select("slug, city, updated_at, category_id")
      .eq("status", "published")
      .limit(5000),
    supabase.from("categories").select("slug"),
  ]);
  const cities = Array.from(
    new Set((businesses ?? []).map((b) => b.city).filter(Boolean)),
  ) as string[];
  const catById = new Map<string, string>();
  for (const c of categories ?? []) {
    // categories query only selected slug; refetch id+slug
  }
  const { data: catRows } = await supabase.from("categories").select("id, slug");
  for (const c of catRows ?? []) catById.set(c.id, c.slug);
  const combos = new Set<string>();
  for (const b of businesses ?? []) {
    if (!b.city || !b.category_id) continue;
    const catSlug = catById.get(b.category_id);
    if (!catSlug) continue;
    const citySlug = String(b.city)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (citySlug) combos.add(`${citySlug}|${catSlug}`);
  }
  return {
    businesses: businesses ?? [],
    categories: categories ?? [],
    cities,
    combos: Array.from(combos).map((s) => {
      const [city, category] = s.split("|");
      return { city, category };
    }),
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
