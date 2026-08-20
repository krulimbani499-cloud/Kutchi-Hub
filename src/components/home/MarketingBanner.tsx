import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBannerAdsForCity } from "@/lib/businesses.functions";
import { useCity } from "@/hooks/useCity";

interface Props {
  intervalMs?: number;
}

export function MarketingBanner({ intervalMs = 4500 }: Props) {
  const { city } = useCity();
  const { data: banners = [] } = useQuery({
    queryKey: ["banner-ads", city ?? "all"],
    queryFn: () => getBannerAdsForCity({ data: { city: city ?? undefined } }),
    staleTime: 60_000,
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), intervalMs);
    return () => clearInterval(t);
  }, [banners.length, intervalMs]);

  if (banners.length === 0) return null;
  const current = banners[index]!;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <a
          href={current.cta_url ?? "#"}
          target={current.cta_url ? "_blank" : undefined}
          rel={current.cta_url ? "noreferrer" : undefined}
          className="block"
        >
          <div className="relative aspect-[21/9] w-full bg-muted">
            <img
              src={current.image_url}
              alt={current.title}
              className="h-full w-full object-cover transition-opacity duration-500"
              loading="lazy"
            />
          </div>
        </a>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-foreground shadow hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => setIndex((i) => (i + 1) % banners.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-foreground shadow hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show banner ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}