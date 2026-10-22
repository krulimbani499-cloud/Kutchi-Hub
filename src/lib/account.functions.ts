import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** How many businesses this account owns (shown in the delete-account confirmation). */
export const getAccountSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", context.userId);
    return { businessCount: count ?? 0 };
  });

/**
 * "Delete my account" (App Store guideline 5.1.1, also available on the website).
 * - Businesses are NEVER hard-deleted: every business the person owns is ARCHIVED (hidden everywhere public, subscriptions and
 *   payment history kept) and loses its link to the account. Quick-listing contact names are cleared (personal data).
 * - Then the sign-in account is deleted. Profile, reviews, favourites, points, notifications, push tokens, roles and referrals
 *   go with it (all are ON DELETE CASCADE / SET NULL on auth.users).
 * Admin accounts cannot delete themselves here.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdmin) throw new Error("An admin account cannot be deleted from here. Please contact Kutchi Hub support.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: owned, error: ownedError } = await supabaseAdmin.from("businesses").select("id").eq("owner_id", userId);
    if (ownedError) throw new Error("Could not delete your account. Please try again.");
    let archived = 0;
    if (owned && owned.length > 0) {
      const ids = owned.map((b) => b.id);
      let { error } = await supabaseAdmin.from("businesses").update({ status: "archived" }).in("id", ids);
      if (error) {
        // 'archived' is not an allowed status in this database yet (supabase/pending/no-hard-delete): hide them as rejected instead.
        console.error("[deleteMyAccount] archive failed, falling back to rejected", error.message);
        ({ error } = await supabaseAdmin.from("businesses").update({ status: "rejected" }).in("id", ids));
      }
      if (error) throw new Error("Could not hide your business listings, so your account was not deleted. Please try again.");
      archived = ids.length;
      // Quick-listing contact person (a personal name): clear it. Ignored when the column does not exist yet.
      await supabaseAdmin.from("businesses").update({ contact_name: null }).in("id", ids);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[deleteMyAccount] deleteUser failed", deleteError.message);
      throw new Error("Could not delete your account. Please try again or contact Kutchi Hub support.");
    }
    return { ok: true as const, archivedBusinesses: archived };
  });
