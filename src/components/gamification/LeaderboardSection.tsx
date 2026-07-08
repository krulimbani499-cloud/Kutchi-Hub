import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Medal } from "lucide-react";
import { getLeaderboard } from "@/lib/gamification.functions";
import { Reveal } from "@/components/Reveal";

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

const RANK_STYLES = [
  "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white",
  "bg-gradient-to-br from-slate-300 to-slate-500 text-white",
  "bg-gradient-to-br from-orange-400 to-orange-600 text-white",
];

export function LeaderboardSection() {
  const fetchFn = useServerFn(getLeaderboard);
  const { data } = useQuery({
    queryKey: ["leaderboard", 10],
    queryFn: () => fetchFn({ data: { limit: 10 } }),
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  return (
    <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border-2 border-[#ff6a00]/20 bg-gradient-to-br from-orange-50/60 via-background to-background p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-sm animate-pulse-glow">
              <Trophy className="h-4 w-4" />
            </span>
            Top Contributors
            <span className="ml-1 rounded-full bg-[#ff6a00]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff6a00]">
              This Month
            </span>
          </h2>
          <p className="hidden text-xs text-muted-foreground sm:block">Earn points by reviewing, saving & listing</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.map((row, i) => (
            <Reveal key={row.user_id} delay={i * 40} y={8}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    i < 3 ? RANK_STYLES[i] : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < 3 ? <Medal className="h-4 w-4" /> : `#${i + 1}`}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-100 to-orange-200 text-sm font-bold text-[#ff6a00]">
                  {row.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(row.display_name).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">
                    {row.display_name || "Kutchi Member"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.events_count} action{row.events_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black tabular-nums text-[#ff6a00]">
                    {row.total_points.toLocaleString()}
                  </div>
                  <div className="text-[9px] font-semibold uppercase text-muted-foreground">pts</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Reveal>
  );
}