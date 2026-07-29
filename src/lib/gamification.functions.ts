import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";

export type BadgeKey =
  | "first_step"
  | "reviewer"
  | "top_reviewer"
  | "explorer"
  | "business_owner"
  | "local_guide"
  | "kutchi_champion";

export type MyGamification = {
  totalPoints: number;
  level: number;
  nextLevelPoints: number;
  progressPct: number;
  counts: { review: number; favorite: number; business_added: number; total: number };
  badges: BadgeKey[];
  recent: { action: string; points: number; created_at: string }[];
};

function computeLevel(points: number) {
  // Level 1 at 0, next level every 100 pts, capped visually at 20
  const level = 1 + Math.floor(points / 100);
  const nextLevelPoints = level * 100;
  const progressPct = Math.min(100, Math.round(((points % 100) / 100) * 100));
  return { level, nextLevelPoints, progressPct };
}

function computeBadges(counts: { review: number; favorite: number; business_added: number }, totalPoints: number): BadgeKey[] {
  const b: BadgeKey[] = [];
  if (counts.review + counts.favorite + counts.business_added >= 1) b.push("first_step");
  if (counts.review >= 5) b.push("reviewer");
  if (counts.review >= 20) b.push("top_reviewer");
  if (counts.favorite >= 10) b.push("explorer");
  if (counts.business_added >= 1) b.push("business_owner");
  if (totalPoints >= 500) b.push("local_guide");
  if (totalPoints >= 2000) b.push("kutchi_champion");
  return b;
}

export const getMyGamification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyGamification> => {
    const { supabase, userId } = context;
    const { data: events, error } = await supabase
      .from("point_events")
      .select("action, points, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const counts = { review: 0, favorite: 0, business_added: 0, total: 0 };
    let totalPoints = 0;
    for (const e of events ?? []) {
      totalPoints += e.points;
      counts.total += 1;
      if (e.action === "review") counts.review += 1;
      else if (e.action === "favorite") counts.favorite += 1;
      else if (e.action === "business_added") counts.business_added += 1;
    }
    const { level, nextLevelPoints, progressPct } = computeLevel(totalPoints);
    const badges = computeBadges(counts, totalPoints);
    return {
      totalPoints,
      level,
      nextLevelPoints,
      progressPct,
      counts,
      badges,
      recent: (events ?? []).slice(0, 10),
    };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ limit: z.coerce.number().int().min(1).max(50).optional().default(10) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const { data: rows, error } = await supabase.rpc("get_leaderboard", { _limit: data.limit });
    if (error) throw new Error(error.message);
    return (rows ?? []) as {
      user_id: string;
      total_points: number;
      events_count: number;
      display_name: string | null;
      avatar_url: string | null;
    }[];
  });