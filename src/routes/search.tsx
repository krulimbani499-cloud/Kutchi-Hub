import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { getCategories, searchBusinesses } from "@/lib/businesses.functions";
import { Button } from "@/components/ui/button";
import { Loader2, LocateFixed } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCity } from "@/hooks/useCity";
import { CategoryBanner, useCategoryBanners } from "@/components/category/CategoryBanner";
import { sortCategoriesAZ } from "@/lib/category-sort";
import { CityCoverageCard } from "@/components/home/CityCoverageCard";
import { ListingPageSkeleton } from "@/components/layout/PageSkeleton";
import { FilterBar, type FilterDraft } from "@/components/search/FilterBar";
import { LeadForm } from "@/components/search/LeadForm";
import { SHOW_SEARCH_LEAD_FORM } from "@/lib/features";
import { ResultCard, ResultCardSkeleton } from "@/components/search/ResultCard";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { roundPos, useVisitorPosition, type Position } from "@/hooks/useVisitorPosition";
import { CITY_ALL, effectiveCity, validateSearchParams, type SearchParams, type SortValue } from "@/lib/search-filters";

// Businesses are loaded one page at a time; the server also returns the true total of matches.
const PAGE_SIZE = 20;
/** On a phone the "Get the list" form sits in the list after this many results (the end of an endless list is never reached). */
const PHONE_FORM_AFTER = 5;

/** Every filter is in the key: changing any of them starts again from the first page. */
const searchInfiniteOptions = (p: {
  q: string;
  category: string;
  city: string;
  sort: string;
  rating: number | undefined;
  open: boolean;
  verified: boolean;
  offer: boolean;
  here: Position | null;
  /** A locality was picked inside the city: the default order is nearest to it first. */
  areaFirst: boolean;
}) => ({
  queryKey: ["search", p] as const,
  initialPageParam: 1,
  queryFn: ({ pageParam }: { pageParam: number }) =>
    searchBusinesses({
      data: {
        q: p.q,
        category: p.category,
        city: p.city,
        sort: p.sort as SortValue,
        minRating: p.rating,
        hasDiscount: p.offer,
        verified: p.verified,
        openNow: p.open,
        lat: p.here?.lat,
        lng: p.here?.lng,
        areaFirst: p.areaFirst || undefined,
        page: pageParam,
        limit: PAGE_SIZE,
      },
    }),
  getNextPageParam: (last: Awaited<ReturnType<typeof searchBusinesses>>) => (last.hasMore ? last.page + 1 : undefined),
});

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
  // The category list changes a few times a year: keep it for 10 minutes instead of asking again on every visit.
  staleTime: 10 * 60_000,
});

export const Route = createFileRoute("/search")({
  // The address carries the filters (?category=dentists&city=Bhuj&sort=rating&open=true ...), so a link opens the same list.
  // Every known key is returned, as undefined when it is off or invalid: the router puts the unchecked address values under the
  // checked ones, so a key that is simply left out would come through unchecked ("?rating=banana").
  validateSearch: (raw: Record<string, unknown>): SearchParams => {
    const v = validateSearchParams(raw);
    return { q: v.q, category: v.category, city: v.city, sort: v.sort, rating: v.rating, open: v.open, verified: v.verified, offer: v.offer };
  },
  head: () => ({
    meta: [
      { title: "Search Businesses — Kutchi Hub" },
      { name: "description", content: "Search for local businesses, read reviews, and find contact details." },
      { property: "og:title", content: "Search Businesses — Kutchi Hub" },
      { property: "og:description", content: "Search Kutchi businesses across categories and cities. Verified listings, reviews and direct contact." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  // Start loading categories but don't wait: the page renders at once and fills in as data arrives.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(categoriesQueryOptions);
  },
  pendingComponent: ListingPageSkeleton,
  component: SearchPage,
});

function SearchPage() {
  const params = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: categoriesData, isPending: categoriesPending } = useQuery(categoriesQueryOptions);
  const categories = useMemo(() => sortCategoriesAZ(categoriesData ?? []), [categoriesData]);
  const { city: headerCity, coords: headerCoords, area, allLocations, loaded: cityLoaded, setCity } = useCity();

  // The city this list is for: the address wins (city=all means every city), otherwise the city chosen in the header.
  const city = effectiveCity(params.city, headerCity);

  /** Changes some filters in the address (the list follows). `undefined` removes a filter. */
  const update = useCallback(
    (patch: Partial<Record<keyof SearchParams, unknown>>) => {
      void navigate({
        search: (prev) => validateSearchParams({ ...prev, ...patch }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  // The person changed the city in the header (a city, or All locations): the list follows it, so an explicit city in the address
  // is dropped. The very first read of the stored choice is not a change.
  const headerChoice = headerCity ?? (allLocations ? "__all__" : "");
  const lastHeaderChoice = useRef<string | null>(null);
  useEffect(() => {
    if (!cityLoaded) return;
    if (lastHeaderChoice.current === null) {
      lastHeaderChoice.current = headerChoice;
      return;
    }
    if (lastHeaderChoice.current === headerChoice) return;
    lastHeaderChoice.current = headerChoice;
    update({ city: undefined });
  }, [cityLoaded, headerChoice, update]);

  // ---- Where the visitor is (only asked when "Nearest" is picked): see useVisitorPosition.
  const { geo, locating, askPosition } = useVisitorPosition();

  // The position the distances are measured from: the visitor's own, else (only for "Nearest") the centre of the chosen city.
  const sort = params.sort ?? "relevance";
  const cityCentre = headerCoords && headerCity && headerCity === city ? roundPos(headerCoords) : null;
  // A locality picked inside this city ("Naroda" in Ahmedabad): the list is nearest to it first and the distances are from it.
  const areaPos: Position | null = area && headerCity && headerCity === city ? roundPos({ lat: area.lat, lng: area.lng }) : null;
  const here: Position | null = sort === "nearest" ? (geo ?? areaPos ?? cityCentre) : (areaPos ?? geo);
  const fromArea = !!areaPos && !!here && here.lat === areaPos.lat && here.lng === areaPos.lng && !(sort === "nearest" && geo);
  const distanceFrom: "you" | "city" | "area" = fromArea ? "area" : geo ? "you" : "city";

  /** Picks a sort order. "Nearest" first needs a position: the device's, else the chosen city's centre. */
  const chooseSort = useCallback(
    async (value: SortValue) => {
      if (value !== "nearest" || geo || cityCentre) {
        update({ sort: value === "relevance" ? undefined : value });
        return;
      }
      const pos = await askPosition();
      if (pos) update({ sort: "nearest" });
      else toast.error("We could not find your location. Allow location access to sort by nearest.");
    },
    [geo, cityCentre, update, askPosition],
  );

  const toggle = (key: "rating" | "open" | "verified" | "offer") =>
    update(key === "rating" ? { rating: params.rating ? undefined : 4 } : { [key]: params[key] ? undefined : true });

  // "Clear" on the chip row switches the four chips off; "Clear all" (panel, empty list) also drops the text search and the category.
  const clearChips = () => update({ rating: undefined, open: undefined, verified: undefined, offer: undefined });
  const clearAll = () => update({ q: undefined, category: undefined, rating: undefined, open: undefined, verified: undefined, offer: undefined });

  const applyDraft = (d: FilterDraft) => {
    const base = headerCity ?? "";
    const typed = d.city.trim();
    update({
      q: d.q.trim() || undefined,
      category: d.category === "all" ? undefined : d.category,
      city: typed.toLowerCase() === base.toLowerCase() ? undefined : typed || CITY_ALL,
      rating: d.rating ? 4 : undefined,
      open: d.open || undefined,
      verified: d.verified || undefined,
      offer: d.offer || undefined,
    });
    if (d.sort !== sort) void chooseSort(d.sort);
  };

  const searchEnabled = cityLoaded || params.city !== undefined;
  const {
    data: searchData,
    isPending: resultsPending,
    isError,
    isPlaceholderData: resultsStale,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...searchInfiniteOptions({
      q: params.q ?? "",
      category: params.category ?? "",
      city,
      sort,
      rating: params.rating,
      open: !!params.open,
      verified: !!params.verified,
      offer: !!params.offer,
      here,
      areaFirst: !!areaPos && sort === "relevance",
    }),
    enabled: searchEnabled,
    // keepPreviousData: changing a filter keeps showing the old results (dimmed) until the new ones arrive.
    placeholderData: keepPreviousData,
    // A search that is no longer on screen is not kept: coming back to it starts from page 1 instead of restoring every page.
    gcTime: 0,
  });

  // All loaded pages as one list (a business can never appear twice) and the true number of matches.
  const results = useMemo(() => {
    const seen = new Set<string>();
    const list: NonNullable<typeof searchData>["pages"][number]["items"] = [];
    for (const page of searchData?.pages ?? []) {
      for (const b of page.items) {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          list.push(b);
        }
      }
    }
    return list;
  }, [searchData]);
  const total = searchData?.pages[searchData.pages.length - 1]?.total ?? 0;
  const activeCategory = useMemo(() => categories.find((c) => c.slug === params.category) ?? null, [categories, params.category]);
  // The category banner sits above the list: the list stays behind its skeleton until the banner is known, so it never jumps down.
  const { settled: bannerSettled } = useCategoryBanners(activeCategory?.id, city);
  const bannerKnown = !params.category || (!categoriesPending && bannerSettled);
  const loading = resultsPending || !searchEnabled || !bannerKnown;

  // Auto-load the next page when the end of the list comes near the screen. The "Load more" button is the fallback.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || resultsStale || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
      },
      // 400px of head start BELOW the screen only. With the margin on top as well, a phone sitting on the (tall) footer still counted
      // the end of the list as "near" (it is ~400px above), and the browser keeps the footer in place when a page is added, so the
      // next page loaded again and again until all 107 were in.
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, resultsStale, fetchNextPage, results.length]);

  const anyFilter = !!(params.q || params.category || params.rating || params.open || params.verified || params.offer);
  const countText = loading || resultsStale ? "Loading..." : `${total} ${total === 1 ? "result" : "results"}`;

  const leadForm = (className = "") =>
    SHOW_SEARCH_LEAD_FORM && (
    <LeadForm categoryId={activeCategory?.id ?? null} categoryName={activeCategory?.name ?? null} city={city} className={className} />
    );

  const empty = (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-muted-foreground">{anyFilter ? "No businesses match these filters. Try clearing some." : "No businesses found matching your search."}</p>
      {anyFilter && (
        <Button variant="outline" className="mt-4" onClick={clearAll}>
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <ResultsHeader
        q={params.q}
        city={city}
        category={activeCategory}
        total={loading || resultsStale ? null : total}
        right={<p className="shrink-0 pb-1 text-sm text-muted-foreground">{countText}</p>}
      />

      <FilterBar
        params={params}
        city={city}
        categories={categories}
        categoriesPending={categoriesPending}
        locating={locating}
        onSort={(v) => void chooseSort(v)}
        onToggle={toggle}
        onClearQuery={() => update({ q: undefined })}
        onApply={applyDraft}
        onClearChips={clearChips}
        onClearAll={clearAll}
      />

      <div className={SHOW_SEARCH_LEAD_FORM ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" : "grid gap-6"}>
        <div className="min-w-0">
          {/* Shown in the same moment as the list (never above a skeleton, which it would push down). */}
          {activeCategory && !loading && <CategoryBanner categoryId={activeCategory.id} city={city} />}

          {sort === "nearest" && !here && !locating && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <span className="text-muted-foreground">Allow location access to sort by distance.</span>
              <Button size="sm" variant="outline" onClick={() => void askPosition()}>
                <LocateFixed className="mr-1.5 h-4 w-4" /> Use my location
              </Button>
            </div>
          )}

          {loading ? (
            <div key="skeleton" className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <ResultCardSkeleton key={i} />
              ))}
            </div>
          ) : isError && results.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">We could not load the results.</p>
              <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : results.length > 0 ? (
            <div key="list" data-results-list className={`flex flex-col gap-4 transition-opacity ${resultsStale ? "opacity-60" : ""}`}>
              {results.map((business, i) => (
                <Fragment key={business.id}>
                  <ResultCard business={business} distanceFrom={distanceFrom} areaName={areaPos ? area?.name : null} priority={i < 2} />
                  {SHOW_SEARCH_LEAD_FORM && i === Math.min(PHONE_FORM_AFTER, results.length) - 1 && <div className="lg:hidden">{leadForm()}</div>}
                </Fragment>
              ))}
            </div>
          ) : (
            <>
              {/* No result for a place that has no business at all: suggest the nearest cities that have some. */}
              {city ? (
                <CityCoverageCard
                  city={city}
                  coords={city === headerCity ? headerCoords : null}
                  fallback={empty}
                  onPick={(next) => {
                    setCity(next);
                    update({ city: next });
                  }}
                />
              ) : (
                empty
              )}
              {SHOW_SEARCH_LEAD_FORM && <div className="mt-4 lg:hidden">{leadForm()}</div>}
            </>
          )}

          {/* End of the list: the next page loads by itself when this comes near the screen; the button is the fallback. */}
          {results.length > 0 && (
            <div ref={sentinelRef} className="mt-6 flex min-h-10 flex-col items-center justify-center gap-2" data-testid="load-more">
              {isFetchingNextPage && (
                <span role="status" aria-label="Loading more" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
                </span>
              )}
              {hasNextPage && !isFetchingNextPage && !resultsStale && (
                <Button variant="outline" onClick={() => void fetchNextPage()}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </div>

        {SHOW_SEARCH_LEAD_FORM && (
          <aside className="hidden lg:block" aria-label="Get the list">
            <div className="sticky top-24">{leadForm()}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
