import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["relevance", "rating", "newest"]).optional().default("relevance"),
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
        "id, name, slug, description, address, city, state, phone, verified, featured_image, status, categories:category_id(id, name, slug, color)",
      )
      .eq("status", "published");

    if (data.q) {
      const term = data.q.trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,description.ilike.%${term}%,city.ilike.%${term}%`,
        );
      }
    }

    if (data.category && data.category !== "all") {
      query = query.eq("categories.slug", data.category);
    }

    if (data.city && data.city !== "all") {
      query = query.ilike("city", `%${data.city}%`);
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

    if (data.minRating && data.minRating > 0) {
      return results.filter((b) => b.avgRating >= data.minRating!);
    }

    if (data.sort === "rating") {
      results.sort((a, b) => b.avgRating - a.avgRating);
    } else if (data.sort === "newest") {
      results.sort(
        (a, b) =>
          new Date((b as unknown as { created_at: string }).created_at).getTime() -
          new Date((a as unknown as { created_at: string }).created_at).getTime(),
      );
    }

    return results;
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

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const [{ data: categories }, { data: featured }] = await Promise.all([
    supabase.from("categories").select("*").order("display_order", { ascending: true }).limit(12),
    supabase
      .from("businesses")
      .select("id, name, slug, description, address, city, phone, verified, featured_image, categories:category_id(id, name, slug, color)")
      .eq("status", "published")
      .order("verified", { ascending: false })
      .limit(8),
  ]);

  const businessIds = (featured ?? []).map((b) => b.id);
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

  return { categories: categories ?? [], featured: listings };
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
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  hours: z.record(z.string()).optional(),
  featured_image: z.string().max(1000).optional().or(z.literal("")),
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
        featured_image: data.featured_image || null,
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
        featured_image: rest.featured_image || null,
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
