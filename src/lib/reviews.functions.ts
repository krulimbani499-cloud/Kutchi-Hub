import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const replySchema = z.object({
  reviewId: z.string().uuid(),
  reply: z.string().trim().min(1).max(1000),
});

export const replyToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => replySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("business_reviews")
      .update({
        owner_reply: data.reply,
        owner_reply_at: new Date().toISOString(),
      })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
