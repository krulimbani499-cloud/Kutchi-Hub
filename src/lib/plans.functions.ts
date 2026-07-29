import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

export const listActivePlans = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("plans" as never)
    .select("*")
    .eq("is_active", true)
    .order("tier_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlanRow[];
});

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plans" as never)
      .select("*")
      .order("tier_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PlanRow[];
  });

export const listAdSlots = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ad_slots" as never)
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdSlotRow[];
});

export const adminListAdSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ad_slots" as never)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdSlotRow[];
  });

const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and dashes only"),
  tier_order: z.number().int().min(0).max(999).default(0),
  price_monthly: z.number().min(0).default(0),
  price_yearly: z.number().min(0).default(0),
  description: z.string().trim().max(500).optional().nullable(),
  features: z.array(z.string().trim().max(200)).max(30).default([]),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  is_active: z.boolean().default(true),
  is_popular: z.boolean().default(false),
  max_photos: z.number().int().min(0).nullable().optional(),
  max_products: z.number().int().min(0).nullable().optional(),
  max_services: z.number().int().min(0).nullable().optional(),
  max_events: z.number().int().min(0).nullable().optional(),
  featured_listing: z.boolean().default(false),
  verified_badge: z.boolean().default(false),
  top_ranking: z.boolean().default(false),
  unlimited_leads: z.boolean().default(false),
  priority_support: z.boolean().default(false),
  analytics_access: z.boolean().default(false),
  banner_ad_slots: z.number().int().min(0).default(0),
});

async function assertAdmin(context: { supabase: ReturnType<typeof createServerSupabaseClient>; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { id, ...rest } = data;
    const payload = { ...rest, features: rest.features } as never;
    if (id) {
      const { data: row, error } = await context.supabase.from("plans" as never).update(payload).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("plans" as never).insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("plans" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

const adSlotSchema = z.object({
  id: z.string().uuid().optional(),
  slot_key: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  price_monthly: z.number().min(0).default(0),
  price_yearly: z.number().min(0).default(0),
  max_active: z.number().int().min(1).max(100).default(1),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
});

export const upsertAdSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adSlotSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("ad_slots" as never).update(rest as never).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("ad_slots" as never).insert(rest as never).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAdSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("ad_slots" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// Subscriptions
export const adminListBusinessesForSubs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("businesses")
      .select("id, name, slug, city, current_plan_id")
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as BusinessLite[];
  });

export const adminListSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ businessId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    let q = context.supabase
      .from("business_subscriptions" as never)
      .select("*, plan:plans(name, slug, color), business:businesses(name, slug)")
      .order("created_at", { ascending: false });
    if (data.businessId) q = q.eq("business_id", data.businessId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as SubscriptionRow[];
  });

const subSchema = z.object({
  businessId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "yearly"]),
  startedAt: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  amountPaid: z.number().min(0).optional().nullable(),
  paymentRef: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["active", "expired", "pending", "cancelled"]).default("active"),
});

export const assignPlanToBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    // insert subscription
    const payload = {
      business_id: data.businessId,
      plan_id: data.planId,
      billing_cycle: data.billingCycle,
      started_at: data.startedAt ? new Date(data.startedAt).toISOString() : new Date().toISOString(),
      expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      amount_paid: data.amountPaid ?? null,
      payment_ref: data.paymentRef ?? null,
      notes: data.notes ?? null,
      status: data.status,
      created_by: context.userId,
    } as never;
    const { data: sub, error } = await context.supabase.from("business_subscriptions" as never).insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    // update business cache
    if (data.status === "active") {
      await context.supabase.from("businesses").update({ current_plan_id: data.planId } as never).eq("id", data.businessId);
    }
    return sub;
  });

export const cancelBusinessSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: sub, error } = await context.supabase
      .from("business_subscriptions" as never)
      .update({ status: "cancelled" } as never)
      .eq("id", data.id)
      .select("business_id")
      .single();
    if (error) throw new Error(error.message);
    const businessId = (sub as { business_id?: string } | null)?.business_id;
    if (businessId) {
      await context.supabase.from("businesses").update({ current_plan_id: null } as never).eq("id", businessId);
    }
    return { success: true };
  });

// Types
export type PlanRow = {
  id: string;
  name: string;
  slug: string;
  tier_order: number;
  price_monthly: number;
  price_yearly: number;
  description: string | null;
  features: string[];
  color: string | null;
  icon: string | null;
  is_active: boolean;
  is_popular: boolean;
  max_photos: number | null;
  max_products: number | null;
  max_services: number | null;
  max_events: number | null;
  featured_listing: boolean;
  verified_badge: boolean;
  top_ranking: boolean;
  unlimited_leads: boolean;
  priority_support: boolean;
  analytics_access: boolean;
  banner_ad_slots: number;
};

export type AdSlotRow = {
  id: string;
  slot_key: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_active: number;
  is_active: boolean;
  display_order: number;
};

export type BusinessLite = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  current_plan_id: string | null;
};

export type SubscriptionRow = {
  id: string;
  business_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  started_at: string;
  expires_at: string | null;
  amount_paid: number | null;
  payment_ref: string | null;
  notes: string | null;
  created_at: string;
  plan?: { name: string; slug: string; color: string | null } | null;
  business?: { name: string; slug: string } | null;
};