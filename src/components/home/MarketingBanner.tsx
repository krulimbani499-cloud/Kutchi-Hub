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
          <div className="relative aspect-[16/5] w-full bg-muted sm:aspect-[16/4]">
            <img
              src={current.image_url}
              alt={current.title}
              className="h-full w-full object-cover transition-opacity duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center gap-2 p-5 sm:p-8">
              <span className="w-fit rounded-full bg-[#ff6a00] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Sponsored{city ? ` · ${city}` : ""}
              </span>
              <h3 className="max-w-lg text-lg font-extrabold leading-tight text-white sm:text-2xl md:text-3xl">
                {current.title}
              </h3>
              {current.subtitle && (
                <p className="max-w-md text-xs text-white/90 sm:text-sm">{current.subtitle}</p>
              )}
              {current.cta_label && (
                <span className="mt-2 inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-xs font-bold text-foreground shadow-sm sm:text-sm">
                  {current.cta_label}
                </span>
              )}
            </div>
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