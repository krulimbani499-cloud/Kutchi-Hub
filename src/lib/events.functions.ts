import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

export const listPublicEvents = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("published", true)
    .order("start_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listUpcomingEvents = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("events")
      .select("*")
      .eq("published", true)
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(data.limit ?? 6);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("events")
      .select("*")
      .order("start_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  contact: z.string().trim().max(300).optional().nullable(),
  linkUrl: z.string().trim().max(1000).optional().nullable(),
  published: z.boolean().optional(),
});

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => eventSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const payload = {
      title: data.title,
      description: data.description || null,
      start_at: new Date(data.startAt).toISOString(),
      end_at: data.endAt ? new Date(data.endAt).toISOString() : null,
      location: data.location || null,
      city: data.city || null,
      image_url: data.imageUrl || null,
      category: data.category || null,
      contact: data.contact || null,
      link_url: data.linkUrl || null,
      published: data.published ?? true,
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("events")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("events")
      .insert({ ...payload, created_by: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });