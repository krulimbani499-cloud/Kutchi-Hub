import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";
import { EDIT_LOCKED_MESSAGE, friendlyEditError } from "./edit-lock";
import { httpsLink } from "./url";

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
  // Optional link (Drive / website), https:// only. "" clears it. Sent only when there is one or it is being cleared.
  linkUrl: httpsLink(),
});

const PRODUCT_LINK_NEEDS_MIGRATION = "The product link needs a database update first (supabase/pending/catalog-link). Nothing was saved.";
const isMissingLinkColumn = (error: { code?: string; message?: string }) =>
  (error.code === "42703" || error.code === "PGRST204" || /does not exist|schema cache/i.test(error.message ?? "")) && /link_url/.test(error.message ?? "");

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
      ...(data.linkUrl !== undefined ? { link_url: data.linkUrl || null } : {}),
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("business_products")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      // An update the database refuses (owner without an active plan) comes back as "no row": friendly message.
      if (error) throw new Error(isMissingLinkColumn(error) ? PRODUCT_LINK_NEEDS_MIGRATION : friendlyEditError(error, error.message));
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("business_products")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(isMissingLinkColumn(error) ? PRODUCT_LINK_NEEDS_MIGRATION : friendlyEditError(error, error.message));
    return row;
  });

export const deleteBusinessProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("business_products")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(friendlyEditError(error, error.message));
    if (!deleted || deleted.length === 0) {
      // Zero rows: either it is already gone, or the database refused the delete (no active plan).
      const { data: stillThere } = await context.supabase.from("business_products").select("id").eq("id", data.id).maybeSingle();
      if (stillThere) throw new Error(EDIT_LOCKED_MESSAGE);
    }
    return { success: true };
  });