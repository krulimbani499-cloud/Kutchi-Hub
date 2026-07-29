import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { getRecommendations } from "@/lib/businesses.functions";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useCity } from "@/hooks/useCity";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Reveal } from "@/components/Reveal";

export function ForYou() {
  const recent = useRecentlyViewed();
  const { city } = useCity();
  const fetchRecs = useServerFn(getRecommendations);

  const { categorySlugs, excludeIds } = useMemo(() => {
    const slugs = Array.from(
      new Set(recent.map((r) => r.category).filter((c): c is string => !!c)),
    ).slice(0, 6);
    const ids = recent.map((r) => r.id).slice(0, 12);
    return { categorySlugs: slugs, excludeIds: ids };
  }, [recent]);

  const { data } = useQuery({
    queryKey: ["for-you", categorySlugs, excludeIds, city ?? null],
    queryFn: () =>
      fetchRecs({
        data: {
          categorySlugs,
          excludeIds,
          city: city ?? undefined,
          limit: 8,
        },
      }),
    enabled: categorySlugs.length > 0,
    staleTime: 60_000,
  });

  if (categorySlugs.length === 0 || !data || data.length === 0) return null;

  return (
    <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-orange-50/60 via-background to-background p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6a00] to-[#e65a00] text-white shadow-sm animate-pulse-glow">
              <Sparkles className="h-4 w-4" />
            </span>
            Picked For You
            <span className="ml-1 rounded-full bg-[#ff6a00]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff6a00]">
              Personalized
            </span>
          </h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Based on what you've viewed
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((business, i) => (
            <Reveal key={business.id} delay={i * 70} y={12}>
              <BusinessCard business={business} />
            </Reveal>
          ))}
        </div>
      </div>
    </Reveal>
  );
}