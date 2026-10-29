import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBannerAdsForCategory } from "@/lib/businesses.functions";
import { useCity } from "@/hooks/useCity";
import { BannerImage, bannerCarouselHasMobileImage } from "@/components/BannerImage";

interface Props {
  categoryId: string;
  city?: string | null;
  intervalMs?: number;
  /** Banners the page already loaded (for this category and city), so nothing is fetched and nothing pops in later. */
  initialBanners?: CategoryBannerList;
  /**
   * The page knows the category has a banner somewhere, but not whether this visitor's city has one (that is only known in the
   * browser). The banner's space is kept empty until it is known, so the list below does not jump down when the banner arrives.
   */
  reserveSpace?: boolean;
}

export type CategoryBannerList = Awaited<ReturnType<typeof getBannerAdsForCategory>>;

/** The banners of one category in one city (null = every city). Shared so a page can load them on the server too. */
export const categoryBannersQuery = (categoryId: string, city: string | null) =>
  queryOptions({
    queryKey: ["category-banner-ads", categoryId, city?.toLowerCase() ?? "all"],
    queryFn: () => getBannerAdsForCategory({ data: { categoryId, city: city ?? undefined } }),
    staleTime: 60_000,
  });

/**
 * The banners to show, and whether the answer is known yet (`settled`). A page that puts the banner above a list can keep its
 * list behind a skeleton until `settled`, so the list is not pushed down when the banner arrives.
 */
export function useCategoryBanners(categoryId: string | null | undefined, city?: string | null, initialBanners?: CategoryBannerList) {
  const { city: selectedCity } = useCity();
  // useCity() is null until it has read the stored choice (right after mount), so wait one tick before fetching;
  // otherwise banners from every city would load and flash first. A city given by the page needs no waiting.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const pageCity = city?.trim() || null;
  const activeCity = pageCity ?? selectedCity?.trim() ?? null;
  const { data, isPending } = useQuery({
    ...categoryBannersQuery(categoryId ?? "", activeCity),
    // Only a page that named its city can hand over banners (they were loaded for exactly that city).
    initialData: pageCity !== null ? initialBanners : undefined,
    enabled: !!categoryId && (ready || pageCity !== null),
  });
  return { banners: data ?? [], settled: !categoryId || (!isPending && (ready || pageCity !== null)) };
}

export function CategoryBanner({ categoryId, city, intervalMs = 4500, initialBanners, reserveSpace = false }: Props) {
  const { banners, settled } = useCategoryBanners(categoryId, city, initialBanners);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), intervalMs);
    return () => clearInterval(t);
  }, [banners.length, intervalMs]);

  if (!settled && reserveSpace) {
    // Same frame and same box shape as the banner (2:1 on phones, 3:1 from md up), so the swap changes nothing around it.
    return (
      <section className="mb-8" aria-hidden>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="aspect-[2/1] w-full bg-muted md:aspect-[3/1]" />
        </div>
      </section>
    );
  }
  if (banners.length === 0) return null;
  const current = banners[index]!;
  const carouselHasMobile = bannerCarouselHasMobileImage(banners);

  return (
    <section className="mb-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <a
          href={current.cta_url ?? "#"}
          target={current.cta_url ? "_blank" : undefined}
          rel={current.cta_url ? "noreferrer" : undefined}
          className="block"
        >
          <BannerImage banner={current} carouselHasMobile={carouselHasMobile} />
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
