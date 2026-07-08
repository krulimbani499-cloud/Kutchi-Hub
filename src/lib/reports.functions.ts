import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reportSchema = z.object({
  entityType: z.enum(["business", "review"]),
  entityId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      reason: data.reason,
      reporter_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("reports")
      .select("id, entity_type, entity_id, reason, details, status, admin_notes, reporter_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateReportSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  adminNotes: z.string().max(1000).optional(),
});

export const adminUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateReportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Unauthorized");

    const update: Record<string, unknown> = { status: data.status };
    if (typeof data.adminNotes === "string") update.admin_notes = data.adminNotes;

    const { error } = await supabase.from("reports").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
