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
