import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Remember the push-notification token of this phone for the signed-in person (supabase/pending/ios-push/01_migration.sql).
 * Best effort: when the table does not exist yet it answers { ok: false } instead of failing. The token is written with the
 * service client because the same phone may have been used by someone else before (the row simply changes owner).
 */
export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().trim().min(10).max(4096), platform: z.enum(["ios", "android"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("device_tokens" as never)
        .upsert({ user_id: context.userId, token: data.token, platform: data.platform, updated_at: new Date().toISOString() } as never, { onConflict: "token" });
      if (error) {
        console.error("[registerDeviceToken] failed", { code: (error as { code?: string }).code, message: error.message });
        return { ok: false as const };
      }
      return { ok: true as const };
    } catch (e) {
      console.error("[registerDeviceToken] failed", e);
      return { ok: false as const };
    }
  });
