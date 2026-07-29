import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

const enquirySchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is required").max(80),
  phone: z.string().trim().min(6, "Phone is required").max(20),
  email: z.string().email().max(255).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional(),
  serviceNeeded: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
});

export const submitEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => enquirySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("business_enquiries").insert({
      business_id: data.businessId,
      user_id: userId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      message: data.message || null,
      service_needed: data.serviceNeeded || null,
      city: data.city || null,
    });
    if (error) throw new Error(error.message);
    // Log analytics event
    await supabase.from("business_events").insert({
      business_id: data.businessId,
      event_type: "enquiry_submit",
    });
    return { success: true };
  });

export const getOwnerEnquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data, error } = await supabase
      .from("business_enquiries")
      .select("*, businesses:business_id(name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((e) => ({
      ...e,
      businessName: (e as unknown as { businesses: { name: string } | null }).businesses?.name ?? "",
      businessSlug: (e as unknown as { businesses: { slug: string } | null }).businesses?.slug ?? "",
    }));
  });

export const updateEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "contacted", "closed", "spam"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_enquiries")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------- Analytics events ----------

const eventSchema = z.object({
  businessId: z.string().uuid(),
  eventType: z.enum([
    "view",
    "call_click",
    "whatsapp_click",
    "website_click",
    "direction_click",
    "share_click",
  ]),
});

export const logBusinessEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => eventSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    await supabase.from("business_events").insert({
      business_id: data.businessId,
      event_type: data.eventType,
    });
    return { success: true };
  });

export const getBusinessAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await supabase
      .from("business_events")
      .select("event_type, created_at")
      .eq("business_id", data.businessId)
      .gte("created_at", since30);
    if (error) throw new Error(error.message);

    const totals: Record<string, number> = {
      view: 0, call_click: 0, whatsapp_click: 0, website_click: 0,
      direction_click: 0, share_click: 0, enquiry_submit: 0,
    };
    const daily: Record<string, number> = {};
    for (const e of events ?? []) {
      totals[e.event_type] = (totals[e.event_type] ?? 0) + 1;
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      daily[day] = (daily[day] ?? 0) + 1;
    }
    return { totals, daily, totalEvents: events?.length ?? 0 };
  });