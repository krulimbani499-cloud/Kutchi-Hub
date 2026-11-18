import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Review reports, "hide reviews from this user" and the admin queue (App Store guideline 1.2).
 * The tables (review_reports, review_hidden, review_user_blocks) come from supabase/pending/review-reports/01_migration.sql and are
 * not in the generated database types yet, so the client is used untyped here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any, "public", any>;

export const REVIEW_REPORT_REASONS = ["spam", "abusive", "fake", "other"] as const;
export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

const reportSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.enum(REVIEW_REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
});

/** A signed-in user reports one review (once per review). */
export const reportReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Loose;
    const { error } = await db.from("review_reports").insert({
      review_id: data.reviewId,
      reporter_id: context.userId,
      reason: data.reason,
      details: data.details ? data.details : null,
    });
    if (error) {
      if (error.code === "23505") return { success: true, alreadyReported: true };
      if (error.code === "42P01") throw new Error("Reporting is not available yet. Please try again later.");
      if (error.code === "42501") throw new Error("You cannot report this review.");
      throw new Error(error.message);
    }
    return { success: true, alreadyReported: false };
  });

const blockSchema = z.object({ userId: z.string().uuid() });

/** "Hide reviews from this user": only for the signed-in viewer. */
export const blockReviewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => blockSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You cannot hide your own reviews.");
    const db = context.supabase as unknown as Loose;
    const { error } = await db
      .from("review_user_blocks")
      .upsert({ blocker_id: context.userId, blocked_user_id: data.userId }, { onConflict: "blocker_id,blocked_user_id", ignoreDuplicates: true });
    if (error) {
      if (error.code === "42P01") throw new Error("This is not available yet. Please try again later.");
      throw new Error(error.message);
    }
    return { success: true };
  });

export const unblockReviewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => blockSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Loose;
    const { error } = await db
      .from("review_user_blocks")
      .delete()
      .eq("blocker_id", context.userId)
      .eq("blocked_user_id", data.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/** The user ids this viewer has hidden. Fails open (empty list) while the table does not exist yet. */
export const listReviewBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Loose;
    const { data, error } = await db.from("review_user_blocks").select("blocked_user_id").eq("blocker_id", context.userId);
    if (error) return [] as string[];
    return (data ?? []).map((r: { blocked_user_id: string }) => r.blocked_user_id);
  });

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const { data: isAdmin } = await (context.supabase as Loose).rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Unauthorized");
}

export type AdminReviewReport = {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: ReviewReportReason;
  details: string | null;
  status: "open" | "closed";
  admin_action: "hidden" | "dismissed" | null;
  created_at: string;
  closed_at: string | null;
  review: {
    id: string;
    rating: number;
    review: string | null;
    user_id: string;
    business_id: string;
    created_at: string;
    business: { name: string; slug: string } | null;
  } | null;
  /** true while the review is hidden from the public */
  hidden: boolean;
  /** how many reports (any status) this review has */
  reportCount: number;
};

export const adminListReviewReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminReviewReport[]> => {
    await requireAdmin(context);
    const db = context.supabase as unknown as Loose;
    const { data, error } = await db
      .from("review_reports")
      .select(
        "id, review_id, reporter_id, reason, details, status, admin_action, created_at, closed_at, review:business_reviews(id, rating, review, user_id, business_id, created_at, business:businesses(name, slug))",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      if (error.code === "42P01") return [];
      throw new Error(error.message);
    }
    const rows = (data ?? []) as unknown as Omit<AdminReviewReport, "hidden" | "reportCount">[];
    const reviewIds = [...new Set(rows.map((r) => r.review_id))];
    const hidden = new Set<string>();
    if (reviewIds.length > 0) {
      const { data: h } = await db.from("review_hidden").select("review_id").in("review_id", reviewIds);
      for (const x of (h ?? []) as { review_id: string }[]) hidden.add(x.review_id);
    }
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.review_id, (counts.get(r.review_id) ?? 0) + 1);
    return rows.map((r) => ({ ...r, hidden: hidden.has(r.review_id), reportCount: counts.get(r.review_id) ?? 1 }));
  });

const resolveSchema = z.object({
  reportId: z.string().uuid(),
  /** hide = hide the review and close every open report on it; dismiss = close just this report; unhide = show the review again */
  action: z.enum(["hide", "dismiss", "unhide"]),
});

export const adminResolveReviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => resolveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = context.supabase as unknown as Loose;
    const { data: report, error: rErr } = await db.from("review_reports").select("id, review_id").eq("id", data.reportId).maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!report) throw new Error("Report not found");
    const now = new Date().toISOString();

    if (data.action === "hide") {
      const { error } = await db
        .from("review_hidden")
        .upsert({ review_id: report.review_id, hidden_by: context.userId }, { onConflict: "review_id" });
      if (error) throw new Error(error.message);
      const { error: cErr } = await db
        .from("review_reports")
        .update({ status: "closed", admin_action: "hidden", closed_at: now })
        .eq("review_id", report.review_id)
        .eq("status", "open");
      if (cErr) throw new Error(cErr.message);
    } else if (data.action === "dismiss") {
      const { error } = await db
        .from("review_reports")
        .update({ status: "closed", admin_action: "dismissed", closed_at: now })
        .eq("id", data.reportId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("review_hidden").delete().eq("review_id", report.review_id);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });
