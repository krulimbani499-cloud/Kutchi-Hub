import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

export const listBusinessProducts = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("business_products")
      .select("*")
      .eq("business_id", data.businessId)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const productSchema = z.object({
  id: z.string().uuid().optional(),
  businessId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().min(0).max(9999999).nullable().optional(),
  discountPrice: z.coerce.number().min(0).max(9999999).nullable().optional(),
  category: z.string().trim().max(120).optional(),
  stock: z.coerce.number().int().min(0).max(999999).nullable().optional(),
  inStock: z.boolean().optional(),
  imageUrls: z.array(z.string().max(1000)).max(8).optional(),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export const upsertBusinessProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      business_id: data.businessId,
      name: data.name,
      description: data.description || null,
      price: data.price ?? null,
      discount_price: data.discountPrice ?? null,
      category: data.category || null,
      stock: data.stock ?? null,
      in_stock: data.inStock ?? true,
      image_urls: data.imageUrls ?? [],
      display_order: data.displayOrder ?? 0,
      active: data.active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("business_products")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("business_products")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBusinessProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_products")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });