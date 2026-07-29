import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyReferralInfo = {
  code: string;
  count: number;
  pointsEarned: number;
  wasReferred: boolean;
  canApplyCode: boolean;
  invited: { referred_id: string; created_at: string; display_name: string | null }[];
};

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyReferralInfo> => {
    const { supabase, userId } = context;

    // Fetch my profile (code) and my own referrals
    const [{ data: profile }, { data: asReferrer }, { data: asReferred }] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("user_id", userId).maybeSingle(),
      supabase.from("referrals").select("referred_id, created_at").eq("referrer_id", userId).order("created_at", { ascending: false }),
      supabase.from("referrals").select("id").eq("referred_id", userId).maybeSingle(),
    ]);

    const invitedIds = (asReferrer ?? []).map((r) => r.referred_id);
    let names: Record<string, string | null> = {};
    if (invitedIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", invitedIds);
      for (const p of profs ?? []) names[p.user_id] = p.display_name;
    }

    // Fetch signup date to determine canApplyCode
    const { data: userRes } = await supabase.auth.getUser();
    const createdAt = userRes.user?.created_at ? new Date(userRes.user.created_at).getTime() : 0;
    const within14Days = createdAt > Date.now() - 14 * 24 * 60 * 60 * 1000;

    return {
      code: profile?.referral_code ?? "",
      count: asReferrer?.length ?? 0,
      pointsEarned: (asReferrer?.length ?? 0) * 100,
      wasReferred: !!asReferred,
      canApplyCode: within14Days && !asReferred,
      invited: (asReferrer ?? []).map((r) => ({
        referred_id: r.referred_id,
        created_at: r.created_at,
        display_name: names[r.referred_id] ?? null,
      })),
    };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("apply_referral_code", { _code: data.code.toUpperCase() });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; referrer_id: string };
  });