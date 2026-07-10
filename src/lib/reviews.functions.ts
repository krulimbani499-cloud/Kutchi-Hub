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
    const { supabase, userId } = context;
    // Verify the caller owns the business that this review belongs to
    const { data: review, error: rErr } = await supabase
      .from("business_reviews")
      .select("business_id")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!review) throw new Error("Review not found");
    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", review.business_id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!business || business.owner_id !== userId) {
      throw new Error("Only the business owner can reply to this review");
    }
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
