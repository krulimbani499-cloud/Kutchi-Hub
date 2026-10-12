import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";
import { EDIT_LOCKED_MESSAGE, friendlyEditError } from "./edit-lock";

export const listBusinessServices = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("business_services")
      .select("*")
      .eq("business_id", data.businessId)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  businessId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().min(0).max(9999999).nullable().optional(),
  priceUnit: z.enum(["fixed", "starts_at", "per_hour", "per_day", "per_visit", "per_item"]).nullable().optional(),
  imageUrl: z.string().url().max(1000).nullable().optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export const upsertBusinessService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => serviceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      business_id: data.businessId,
      name: data.name,
      description: data.description || null,
      price: data.price ?? null,
      price_unit: data.priceUnit ?? null,
      image_url: data.imageUrl || null,
      display_order: data.displayOrder ?? 0,
      active: data.active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("business_services")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      // An update the database refuses (owner without an active plan) comes back as "no row": friendly message.
      if (error) throw new Error(friendlyEditError(error, error.message));
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("business_services")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(friendlyEditError(error, error.message));
    return row;
  });

export const deleteBusinessService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("business_services")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(friendlyEditError(error, error.message));
    if (!deleted || deleted.length === 0) {
      // Zero rows: either it is already gone, or the database refused the delete (no active plan).
      const { data: stillThere } = await context.supabase.from("business_services").select("id").eq("id", data.id).maybeSingle();
      if (stillThere) throw new Error(EDIT_LOCKED_MESSAGE);
    }
    return { success: true };
  });