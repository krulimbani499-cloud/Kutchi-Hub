import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, keepPreviousData, type InfiniteData } from "@tanstack/react-query";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, LocateFixed, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterDraft } from "@/components/search/FilterBar";
import { ResultCard, ResultCardSkeleton } from "@/components/search/ResultCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { roundPos, useVisitorPosition } from "@/hooks/useVisitorPosition";
import { getCategories, searchAllBusinesses } from "@/lib/businesses.functions";
import { cleanSearchTerm, resultSummary, tierGroup, tierLabel } from "@/lib/all-business";
import { sortCategoriesAZ } from "@/lib/category-sort";
import { BASE_URL, breadcrumbLd, itemListLd, ldScript } from "@/lib/seo";
import { pageMeta, prettySlug } from "@/lib/seo-landing";
import { validateSearchParams, type SearchParams, type SortValue } from "@/lib/search-filters";

// Every published business of every city (the "All Business" tab). The city chosen in the header is ignored on purpose.
const PAGE_SIZE = 20;
const TITLE = "All Businesses | Kutchi Hub";
const DESCRIPTION =
  "Browse every business listed on Kutchi Hub, from all cities: search by name, category, product or service, compare ratings and call or WhatsApp directly.";

type Page = Awaited<ReturnType<typeof searchAllBusinesses>>;

/** What is asked of the server (everything but the page number). */
const queryInput = (p: SearchParams, here: { lat: number; lng: number } | null) => ({
  q: p.q ?? "",
  category: p.category ?? "",
  city: p.city ?? "",
  sort: (p.sort ?? "relevance") as SortValue,
  minRating: p.rating,
  hasDiscount: !!p.offer,
  verified: !!p.verified,
  openNow: !!p.open,
  lat: here?.lat,
  lng: here?.lng,
});

export const Route = createFileRoute("/all-business")({
  // The address carries the search text and the filters (?q=plywood&city=himatnagar&open=true ...): a link opens the same list.
  // Every known key is returned (undefined when off / invalid): see the note in search.tsx.
  validateSearch: (raw: Record<string, unknown>): SearchParams => {
    const v = validateSearchParams(raw);
    return { q: v.q, category: v.category, city: v.city, sort: v.sort, rating: v.rating, open: v.open, verified: v.verified, offer: v.offer };
  },
  // The first page is loaded on the server, so the list is in the page the first time it is served (and can be indexed).
  loader: async ({ location }) => {
    const params = validateSearchParams((location.search ?? {}) as Record<string, unknown>);
    // The plain page is indexable; with a search text or any filter in the address it is not (a copy of the same list).
    const noindex = Object.keys(params).length > 0;
    const input = queryInput(params, null);
    try {
      const page = await searchAllBusinesses({ data: { ...input, page: 1, limit: PAGE_SIZE } });
      return { key: JSON.stringify(input), page, noindex };
    } catch {
      return { key: "", page: null as Page | null, noindex };
    }
  },
  head: ({ loaderData }) => {
    const url = `${BASE_URL}/all-business`;
    const noindex = loaderData?.noindex ?? false;
    return {
      meta: pageMeta({ title: TITLE, description: DESCRIPTION, url, noindex }),
      links: [{ rel: "canonical", href: url }],
      scripts: noindex
        ? []
        : [
            ldScript(
              breadcrumbLd([
                { name: "Home", url: "/" },
                { name: "All Businesses", url: "/all-business" },
              ]),
            ),
            ...(loaderData?.page ? [ldScript(itemListLd(loaderData.page.items.slice(0, 20).map((b) => ({ name: b.name, url: `/business/${b.slug}` }))))] : []),
          ],
    };
  },
  component: AllBusinessPage,
});

/** The height of the sticky site header, so the search box sticks right under it (the phone header is taller than the desktop one). */
function useHeaderHeight(): number {
  const [h, setH] = useState(64);
  useEffect(() => {
    const el = document.querySelector("header");
    if (!el) return;
    const measure = () => setH(Math.round(el.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

function AllBusinessPage() {
  const params = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaderData = Route.useLoaderData();
  const headerH = useHeaderHeight();
  const { data: categoriesData, isPending: categoriesPending } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    staleTime: 10 * 60_000,
  });
  const categories = useMemo(() => sortCategoriesAZ(categoriesData ?? []), [categoriesData]);

  /** Changes some filters in the address (the list follows). `undefined` removes a filter. */
  const update = useCallback(
    (patch: Partial<Record<keyof SearchParams, unknown>>) => {
      void navigate({ search: (prev) => validateSearchParams({ ...prev, ...patch }), replace: true, resetScroll: false });
    },
    [navigate],
  );

  // ---- the search box: the text is kept in the address (?q=) after a short pause in typing
  const [text, setText] = useState(params.q ?? "");
  const debounced = useDebouncedValue(text, 350);
  const lastQ = useRef(params.q ?? "");
  useEffect(() => {
    // Only when the pause has really caught up with what is in the box: right after "clear" or a change of the address the
    // debounced value still holds the OLD text for a moment, and must not put it back.
    if (debounced !== text) return;
    const next = debounced.trim();
    if (next === (params.q ?? "")) return;
    lastQ.current = next;
    update({ q: next || undefined });
  }, [debounced, text, params.q, update]);
  useEffect(() => {
    // The address changed by itself (back / forward): the box follows it.
    if ((params.q ?? "") !== lastQ.current) {
      lastQ.current = params.q ?? "";
      setText(params.q ?? "");
    }
  }, [params.q]);

  // ---- "Nearest" needs the visitor's position (asked only when it is picked)
  const { geo, locating, askPosition } = useVisitorPosition();
  const sort = params.sort ?? "relevance";
  const here = geo ? roundPos(geo) : null;
  const chooseSort = useCallback(
    async (value: SortValue) => {
      if (value !== "nearest" || geo) {
        update({ sort: value === "relevance" ? undefined : value });
        return;
      }
      const pos = await askPosition();
      if (pos) update({ sort: "nearest" });
      else toast.error("We could not find your location. Allow location access to sort by nearest.");
    },
    [geo, update, askPosition],
  );
  const toggle = (key: "rating" | "open" | "verified" | "offer") =>
    update(key === "rating" ? { rating: params.rating ? undefined : 4 } : { [key]: params[key] ? undefined : true });
  const clearChips = () => update({ rating: undefined, open: undefined, verified: undefined, offer: undefined });
  const clearAll = () => update({ category: undefined, rating: undefined, open: undefined, verified: undefined, offer: undefined });
  const applyDraft = (d: FilterDraft) => {
    update({
      category: d.category === "all" ? undefined : d.category,
      rating: d.rating ? 4 : undefined,
      open: d.open || undefined,
      verified: d.verified || undefined,
      offer: d.offer || undefined,
    });
    if (d.sort !== sort) void chooseSort(d.sort);
  };

  // ---- the list: one page at a time, the first page already loaded by the server
  const input = queryInput(params, here);
  const firstLoad = !!loaderData.page && !here && loaderData.key === JSON.stringify(queryInput(params, null));
  const {
    data,
    isPending,
    isError,
    isPlaceholderData: stale,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["all-business", input] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) => searchAllBusinesses({ data: { ...input, page: pageParam, limit: PAGE_SIZE } }),
    getNextPageParam: (last: Page) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    initialData: firstLoad ? ({ pages: [loaderData.page!], pageParams: [1] } satisfies InfiniteData<Page, number>) : undefined,
    staleTime: 30_000,
    gcTime: 0,
  });
  const results = useMemo(() => {
    const seen = new Set<string>();
    const list: Page["items"] = [];
    for (const page of data?.pages ?? []) {
      for (const b of page.items) {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          list.push(b);
        }
      }
    }
    return list;
  }, [data]);
  const last = data?.pages[data.pages.length - 1];
  const total = last?.total ?? 0;
  const cities = last?.cities ?? [];
  const cityName = params.city ? (cities.find((c) => c.slug === params.city)?.name ?? prettySlug(params.city)) : null;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || stale || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
      },
      // 400px of head start BELOW the screen only (not above): on a phone the tall footer kept the end of the list "near" and the
      // next page loaded again and again (same fix as the search page).
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, stale, fetchNextPage, results.length]);

  const loading = isPending;
  // The package dividers only make sense in the package order (the default); another sort mixes the packages.
  const byTier = sort === "relevance";
  // The words searched for (nothing when the box holds less than two characters: then the whole list is shown).
  const searchedTerm = cleanSearchTerm(params.q);
  const anyFilter = !!(params.q || params.category || params.rating || params.open || params.verified || params.offer || params.city);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6">
      <h1 data-all-business-title className="pt-5 text-2xl font-bold text-foreground sm:pt-6 sm:text-3xl">
        All Businesses
      </h1>

      {/* Sticky search: business name, category, description, and the products / services the owner shows publicly. */}
      <div data-all-business-search className="sticky z-30 -mx-4 mb-3 bg-background/95 px-4 py-2.5 backdrop-blur" style={{ top: headerH }}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const next = text.trim();
            lastQ.current = next;
            update({ q: next || undefined });
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Search all businesses"
            placeholder="Search business, city, product, service"
            maxLength={100}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-10 text-base shadow-sm outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00] [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              data-clear-search
              onClick={() => {
                setText("");
                lastQ.current = "";
                update({ q: undefined });
              }}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      <p data-result-summary className="mb-2 text-sm font-medium text-foreground sm:text-base">
        {loading || stale ? "Loading..." : resultSummary({ q: params.q, total, cityCount: cities.length, cityName })}
      </p>

      {cities.length > 0 && (
        <nav data-city-chips aria-label="Cities" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          <CityChip label="All cities" count={last?.allTotal ?? 0} active={!params.city} onClick={() => update({ city: undefined })} data="all" />
          {cities.map((c) => (
            <CityChip key={c.slug} label={c.name} count={c.count} active={params.city === c.slug} onClick={() => update({ city: params.city === c.slug ? undefined : c.slug })} data={c.slug} />
          ))}
        </nav>
      )}

      <FilterBar
        hideCityAndText
        params={{ ...params, q: undefined, city: undefined }}
        city=""
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
          <p className="text-muted-foreground">We could not load the businesses.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : results.length > 0 ? (
        <div key="list" data-results-list className={`flex flex-col gap-4 transition-opacity ${stale ? "opacity-60" : ""}`}>
          {results.map((business, i) => (
            <Fragment key={business.id}>
              {/* The default order is by package: a divider with the package name where the next package starts. */}
              {byTier && (i === 0 || tierGroup(results[i - 1].plan_tier_order) !== tierGroup(business.plan_tier_order)) && (
                <TierDivider tier={business.plan_tier_order} first={i === 0} />
              )}
              <ResultCard business={business} priority={i < 2} />
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          {searchedTerm ? (
            <p data-empty-search className="text-muted-foreground">
              &lsquo;{searchedTerm}&rsquo; ke liye koi business nahi mila
            </p>
          ) : (
            <p className="text-muted-foreground">{anyFilter ? "No businesses match your search. Try other words or clear the filters." : "No businesses to show yet."}</p>
          )}
          {anyFilter && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setText("");
                lastQ.current = "";
                update({ q: undefined, city: undefined, category: undefined, rating: undefined, open: undefined, verified: undefined, offer: undefined });
              }}
            >
              {searchedTerm ? "Saare business dekhein" : "Clear search and filters"}
            </Button>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div ref={sentinelRef} className="mt-6 flex min-h-10 flex-col items-center justify-center gap-2" data-testid="load-more">
          {isFetchingNextPage && (
            <span role="status" aria-label="Loading more" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
            </span>
          )}
          {hasNextPage && !isFetchingNextPage && !stale && (
            <Button variant="outline" onClick={() => void fetchNextPage()}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** "Platinum": a small heading between the packages of the default list. */
function TierDivider({ tier, first }: { tier: number | null | undefined; first: boolean }) {
  return (
    <div data-tier-divider={tierLabel(tier)} role="separator" aria-label={tierLabel(tier)} className={`flex items-center gap-3 ${first ? "" : "pt-2"}`}>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground/80">{tierLabel(tier)}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

function CityChip({ label, count, active, onClick, data }: { label: string; count: number; active: boolean; onClick: () => void; data: string }) {
  return (
    <button
      type="button"
      data-city-chip={data}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors ${
        active ? "border-[#ff6a00] bg-[#ff6a00] text-white" : "border-border bg-background text-foreground hover:border-[#ff6a00]/40 hover:text-[#ff6a00]"
      }`}
    >
      {label}
      <span className={active ? "text-white/90" : "text-muted-foreground"}>({count})</span>
    </button>
  );
}
