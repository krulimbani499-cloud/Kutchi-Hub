import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Star, Heart, Building2, Flame, Award, Crown, Sparkles } from "lucide-react";
import { getMyGamification, type BadgeKey } from "@/lib/gamification.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BADGES: Record<BadgeKey, { label: string; icon: typeof Star; color: string; desc: string }> = {
  first_step: { label: "First Step", icon: Sparkles, color: "from-sky-400 to-sky-600", desc: "Took your first action" },
  reviewer: { label: "Reviewer", icon: Star, color: "from-amber-400 to-amber-600", desc: "5+ reviews" },
  top_reviewer: { label: "Top Reviewer", icon: Award, color: "from-purple-500 to-purple-700", desc: "20+ reviews" },
  explorer: { label: "Explorer", icon: Heart, color: "from-pink-400 to-pink-600", desc: "10+ favorites" },
  business_owner: { label: "Business Owner", icon: Building2, color: "from-emerald-500 to-emerald-700", desc: "Listed a business" },
  local_guide: { label: "Local Guide", icon: Flame, color: "from-orange-500 to-red-500", desc: "500+ points" },
  kutchi_champion: { label: "Kutchi Champion", icon: Crown, color: "from-yellow-400 to-orange-600", desc: "2000+ points" },
};

const ALL_BADGE_KEYS = Object.keys(BADGES) as BadgeKey[];

export function RewardsCard() {
  const fetchFn = useServerFn(getMyGamification);
  const { data } = useQuery({
    queryKey: ["gamification", "me"],
    queryFn: () => fetchFn(),
    staleTime: 30_000,
  });

  if (!data) return null;

  const earned = new Set(data.badges);

  return (
    <Card className="overflow-hidden border-2 border-[#ff6a00]/20">
      <CardHeader className="bg-gradient-to-br from-[#ff6a00] to-[#e65a00] text-white">
        <CardTitle className="flex items-center gap-2 text-white">
          <Trophy className="h-5 w-5" />
          Your Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {/* Points + Level */}
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-black tabular-nums text-foreground">
              {data.totalPoints.toLocaleString()}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">pts</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {data.counts.review} reviews · {data.counts.favorite} saved · {data.counts.business_added} listed
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#ff6a00] to-[#e65a00] px-3 py-1 text-white shadow-sm">
            <Star className="h-3.5 w-3.5 fill-white" />
            <span className="text-xs font-bold">Level {data.level}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
            <span>Progress</span>
            <span>{data.progressPct}% to Level {data.level + 1}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-[#ff6a00] to-[#e65a00] transition-all duration-700"
              style={{ width: `${data.progressPct}%` }}
            />
          </div>
        </div>

        {/* Badges */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Badges ({data.badges.length}/{ALL_BADGE_KEYS.length})
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {ALL_BADGE_KEYS.map((key) => {
              const b = BADGES[key];
              const isEarned = earned.has(key);
              const Icon = b.icon;
              return (
                <div
                  key={key}
                  title={`${b.label} — ${b.desc}`}
                  className={`group flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all ${
                    isEarned
                      ? "border-[#ff6a00]/30 bg-gradient-to-br from-orange-50 to-background hover:-translate-y-0.5 hover:shadow-md"
                      : "border-dashed border-border bg-muted/40 opacity-50"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${
                      isEarned ? b.color : "from-muted to-muted"
                    } text-white shadow-sm`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="line-clamp-1 text-[9px] font-semibold text-foreground">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* How to earn */}
        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-bold text-foreground">Earn points:</p>
          <p>⭐ Write a review: <b>+20</b> · ❤️ Save a business: <b>+5</b> · 🏪 List a business: <b>+50</b></p>
        </div>
      </CardContent>
    </Card>
  );
}