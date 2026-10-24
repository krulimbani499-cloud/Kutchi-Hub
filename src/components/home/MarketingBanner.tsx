import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBannerAdsForCity } from "@/lib/businesses.functions";
import { useCity } from "@/hooks/useCity";
import { BannerImage, bannerCarouselHasMobileImage } from "@/components/BannerImage";
import type { BannerPlacement } from "@/lib/banner-rules";

interface Props {
  intervalMs?: number;
  /** Which homepage slot: under the search box (default) or between Popular Categories and Nearby. Hidden when it has no banners. */
  placement?: BannerPlacement;
}

export function MarketingBanner({ intervalMs = 4500, placement = "home_top" }: Props) {
  const { city, allLocations } = useCity();
  const { data: banners = [] } = useQuery({
    // "All locations" is its own key: every active banner. No choice at all (null) still shows nothing, as before.
    queryKey: ["banner-ads", placement, city ?? (allLocations ? "__all__" : "none")],
    queryFn: () => getBannerAdsForCity({ data: { city: city ?? undefined, all: allLocations || undefined, placement } }),
    staleTime: 5 * 60_000,
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
  const carouselHasMobile = bannerCarouselHasMobileImage(banners);

  return (
    // Phones: 8px side margins (wider, so taller at the same 3:1 ratio the banner images already have); md+ keeps 16px.
    <section className="mx-auto w-full max-w-7xl px-2 pt-4 md:px-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {current.cta_url ? (
          // An address typed on the banner wins ...
          <a href={current.cta_url} target="_blank" rel="noreferrer" className="block">
            <BannerImage banner={current} carouselHasMobile={carouselHasMobile} />
          </a>
        ) : current.business_slug ? (
          // ... otherwise a banner made for a business opens that business's page.
          <Link to="/business/$slug" params={{ slug: current.business_slug }} className="block">
            <BannerImage banner={current} carouselHasMobile={carouselHasMobile} />
          </Link>
        ) : (
          <div className="block">
            <BannerImage banner={current} carouselHasMobile={carouselHasMobile} />
          </div>
        )}

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