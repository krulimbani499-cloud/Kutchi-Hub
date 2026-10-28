import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";
import { EDIT_LOCKED_MESSAGE, friendlyEditError, isEditLockedError } from "./edit-lock";
import { SHOW_PUBLIC_PRICING } from "./features";

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

type DbError = { message?: string; code?: string; details?: string; hint?: string };

/**
 * The text an owner sees when a service could not be saved. Only known, owner-friendly reasons are spelled out;
 * anything else shows just the error code (never the raw database text, keys or a stack trace).
 */
function describeServiceError(err: DbError): string {
  const message = err.message ?? "";
  // enforce_business_plan_limit(): "Plan limit reached — your plan allows only N services. Upgrade to add more."
  const limit = /plan limit reached.*allows only (\d+) services/i.exec(message);
  if (limit) {
    const n = Number(limit[1]);
    return n === 0
      ? `Your plan does not include services. ${SHOW_PUBLIC_PRICING ? "Upgrade your plan to add services." : "Contact Kutchi Hub to add services."}`
      : `Your plan allows ${n} service${n === 1 ? "" : "s"} and you already have ${n}. ${SHOW_PUBLIC_PRICING ? "Upgrade your plan to add more." : "Contact Kutchi Hub to add more."}`;
  }
  if (isEditLockedError(err)) return EDIT_LOCKED_MESSAGE;
  if (err.code === "42501") return "Could not save the service: the server is missing a database permission (code 42501). Please contact support.";
  return err.code ? `Could not save the service (code ${err.code}). Please try again or contact support.` : "Could not save the service. Please try again.";
}

export type UpsertServiceResult = { ok: true; row: Awaited<ReturnType<typeof listBusinessServices>>[number] } | { ok: false; message: string };

/**
 * Failures are RETURNED (ok: false + a readable message) instead of thrown, so the reason always reaches the owner's
 * toast. The underlying error is logged on the server (Vercel logs) with ids only - no keys, no stack.
 */
export const upsertBusinessService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => serviceSchema.parse(input))
  .handler(async ({ data, context }): Promise<UpsertServiceResult> => {
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
    const fail = (err: DbError, step: string): UpsertServiceResult => {
      console.error(`[upsertBusinessService] ${step} failed`, {
        userId: context.userId,
        businessId: data.businessId,
        serviceId: data.id ?? null,
        code: err.code ?? null,
        message: err.message ?? null,
        details: err.details ?? null,
        hint: err.hint ?? null,
      });
      return { ok: false, message: describeServiceError(err) };
    };
    try {
      // An update the database refuses (owner without an active plan) comes back as "no row": friendly message.
      const { data: row, error } = data.id
        ? await context.supabase.from("business_services").update(payload).eq("id", data.id).select("*").single()
        : await context.supabase.from("business_services").insert(payload).select("*").single();
      if (error) return fail(error, data.id ? "update" : "insert");
      return { ok: true, row };
    } catch (e) {
      return fail({ message: e instanceof Error ? e.message : String(e) }, "unexpected");
    }
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