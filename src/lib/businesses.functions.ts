import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

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
      .select(
        "id, name, slug, description, address, city, state, phone, verified, featured_image, hours, status, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published");

    // If the search term matches any category name/slug, resolve those
    // category IDs so we can also match businesses tagged with them.
    let matchingCategoryIds: string[] = [];
    if (data.q) {
      const term = data.q.trim();
      if (term) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id")
          .or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
        matchingCategoryIds = (cats ?? []).map((c) => c.id);
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
        query = query.or(parts.join(","));
      }
    }

    if (data.category && data.category !== "all") {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      if (!cat) {
        return [];
      }
      query = query.eq("category_id", cat.id);
    }

    if (data.city && data.city !== "all") {
      query = query.ilike("city", `%${data.city}%`);
    }

    if (data.hasDiscount) {
      const today = new Date().toISOString().slice(0, 10);
      query = query
        .gt("app_discount_percent", 0)
        .or(`app_discount_valid_until.is.null,app_discount_valid_until.gte.${today}`);
    }

    const { data: businesses, error } = await query
      .order("verified", { ascending: false })
      .order("name", { ascending: true })
      .range(offset, offset + data.limit - 1);

    if (error) throw new Error(error.message);

    const { data: counts } = await supabase
      .from("business_reviews")
      .select("business_id, rating");

    const ratings = new Map<string, { count: number; sum: number }>();
    for (const r of counts ?? []) {
      const entry = ratings.get(r.business_id) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += r.rating;
      ratings.set(r.business_id, entry);
    }

    const results = (businesses ?? []).map((b) => {
      const rating = ratings.get(b.id);
      return {
        ...b,
        avgRating: rating ? Number((rating.sum / rating.count).toFixed(1)) : 0,
        reviewCount: rating?.count ?? 0,
      };
    });

    let filteredResults = results;
    if (data.minRating && data.minRating > 0) {
      filteredResults = filteredResults.filter((b) => b.avgRating >= data.minRating!);
    }

    if (data.sort === "rating") {
      filteredResults.sort((a, b) => b.avgRating - a.avgRating);
    } else if (data.sort === "newest") {
      filteredResults.sort(
        (a, b) =>
          new Date((b as unknown as { created_at: string }).created_at).getTime() -
          new Date((a as unknown as { created_at: string }).created_at).getTime(),
      );
    } else if (data.sort === "discount") {
      filteredResults.sort(
        (a, b) =>
          ((b as unknown as { app_discount_percent: number | null }).app_discount_percent ?? 0) -
          ((a as unknown as { app_discount_percent: number | null }).app_discount_percent ?? 0),
      );
    }

    return filteredResults;
  });

export const getBusinessBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string(), city: z.string().optional() }).parse(input))
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
    if (!business) throw new Error("Business not found");

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

    return {
      business,
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
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  icon: z.string().trim().max(60).nullable().optional(),
  icon_url: z.string().trim().max(200000).nullable().optional(),
  color: z.string().trim().max(30).nullable().optional(),
  display_order: z.coerce.number().int().min(0).max(9999).optional(),
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
    } = {
      name: data.name.trim(),
      slug: data.slug.trim(),
    };
    if (data.icon !== undefined) patch.icon = data.icon?.trim() || null;
    if (data.icon_url !== undefined) patch.icon_url = data.icon_url?.trim() || null;
    if (data.color !== undefined) patch.color = data.color?.trim() || null;
    if (data.display_order !== undefined) patch.display_order = data.display_order;

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

export const getBannerAdsForCity = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ city: z.string().trim().min(1).max(80).optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    // Only show banners for the selected city. If no city is selected,
    // return nothing so city-specific banners don't leak across locations.
    if (!data.city) return [];
    let query = supabase
      .from("banner_ads")
      .select("id, business_id, title, subtitle, image_url, cta_label, cta_url, city, priority")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    query = query.ilike("city", data.city);
    const { data: banners, error } = await query;
    if (error) throw new Error(error.message);
    return banners ?? [];
  });

const bannerInputSchema = z.object({
  business_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(200).nullable().optional(),
  image_url: z.string().trim().url().max(500),
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
        owner_id: context.userId,
        title: data.title,
        subtitle: data.subtitle ?? null,
        image_url: data.image_url,
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
        title: rest.title,
        subtitle: rest.subtitle ?? null,
        image_url: rest.image_url,
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

export const getHomeData = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ city: z.string().optional() }).optional().parse(input) ?? {},
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const city = data?.city?.trim();
    let featuredQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)")
      .eq("status", "published")
      .order("verified", { ascending: false })
      .limit(8);
    if (city) featuredQuery = featuredQuery.ilike("city", city);

    const today = new Date().toISOString().slice(0, 10);
    let offersQuery = supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)")
      .eq("status", "published")
      .gt("app_discount_percent", 0)
      .or(`app_discount_valid_until.is.null,app_discount_valid_until.gte.${today}`)
      .order("app_discount_percent", { ascending: false })
      .limit(8);
    if (city) offersQuery = offersQuery.ilike("city", city);

    const [{ data: categories }, { data: featured }, { data: offers }] = await Promise.all([
      supabase.from("categories").select("*").order("display_order", { ascending: true }).limit(12),
      featuredQuery,
      offersQuery,
    ]);

  const businessIds = Array.from(
    new Set([...(featured ?? []).map((b) => b.id), ...(offers ?? []).map((b) => b.id)]),
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

    return { categories: categories ?? [], featured: listings, topOffers };
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
        "id, name, slug, description, address, city, phone, verified, featured_image, hours, app_discount_percent, app_discount_label, app_discount_valid_until, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .in("category_id", categoryIds)
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
  slug: z.string().min(2).max(120),
  category_id: z.string().uuid(),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120),
  state: z.string().max(120).optional(),
  pincode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  website: z.string().url().max(500).optional().or(z.literal("")),
  instagram_url: z.string().url().max(500).optional().or(z.literal("")),
  facebook_url: z.string().url().max(500).optional().or(z.literal("")),
  youtube_url: z.string().url().max(500).optional().or(z.literal("")),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  hours: z.record(z.string()).optional(),
  featured_image: z.string().max(1000).optional().or(z.literal("")),
  app_discount_percent: z.coerce.number().int().min(0).max(100).nullable().optional(),
  app_discount_label: z.string().max(80).optional().or(z.literal("")),
  app_discount_valid_until: z.string().max(20).optional().or(z.literal("")),
});

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => businessFormSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

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
        owner_id: userId,
        status: "pending",
        website: data.website || null,
        email: data.email || null,
        instagram_url: data.instagram_url || null,
        facebook_url: data.facebook_url || null,
        youtube_url: data.youtube_url || null,
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
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Business not found");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (existing.owner_id !== userId && !isAdmin) throw new Error("Unauthorized");

    const { id, ...rest } = data;
    const { error } = await supabase
      .from("businesses")
      .update({
        ...rest,
        website: rest.website || null,
        email: rest.email || null,
        instagram_url: rest.instagram_url || null,
        facebook_url: rest.facebook_url || null,
        youtube_url: rest.youtube_url || null,
        featured_image: rest.featured_image || null,
        app_discount_percent:
          rest.app_discount_percent == null || Number.isNaN(rest.app_discount_percent)
            ? null
            : rest.app_discount_percent,
        app_discount_label: rest.app_discount_label ? rest.app_discount_label : null,
        app_discount_valid_until: rest.app_discount_valid_until ? rest.app_discount_valid_until : null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
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
      .select("id, name, slug, description, address, city, state, phone, email, website, featured_image, status, created_at, owner_id, categories:category_id(name, slug)")
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
      .select("id, name, slug, city, verified, created_at, categories:category_id(name)")
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
      .select("id, name, slug, status, city, category_id, categories:category_id(name, slug)")
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

    const typedBusinesses = (businesses ?? []).map((b) => ({
      id: (b as unknown as { id: string }).id,
      name: (b as unknown as { name: string }).name,
      slug: (b as unknown as { slug: string }).slug,
      status: (b as unknown as { status: string }).status,
      city: (b as unknown as { city: string | null }).city,
      categoryName: (b as unknown as { categories: { name: string } | null }).categories?.name ?? "",
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

export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: existing } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", data.id)
      .single();
    if (!existing) throw new Error("Business not found");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (existing.owner_id !== context.userId && !isAdmin) throw new Error("Unauthorized");

    const { error } = await supabase.from("businesses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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

    return { business, photos: photos ?? [] };
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
        "id, name, slug, description, address, city, phone, verified, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .eq("category_id", category.id)
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
        "id, name, slug, description, address, city, phone, verified, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .ilike("city", `%${cityName}%`)
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
        "id, name, slug, description, address, city, phone, verified, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .neq("id", data.businessId)
      .limit(6);
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.city) query = query.ilike("city", data.city);
    const { data: businesses, error } = await query
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
        "id, name, slug, description, address, city, phone, verified, featured_image, hours, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published")
      .eq("category_id", category.id)
      .ilike("city", `%${cityName}%`)
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
