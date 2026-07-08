import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { getCategories, searchBusinesses } from "@/lib/businesses.functions";
import { isOpenNow } from "@/lib/business-hours";
import { CategoryGrid } from "@/components/business/CategoryGrid";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, BadgeCheck, Clock, Star, X, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCity } from "@/hooks/useCity";

const searchQueryOptions = (q: string, category: string, city: string, sort: string, hasDiscount: boolean) =>
  queryOptions({
    queryKey: ["search", q, category, city, sort, hasDiscount],
    queryFn: () => searchBusinesses({ data: { q, category, city, sort, hasDiscount } }),
  });

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Businesses — Kutchi Hub" },
      { name: "description", content: "Search for local businesses, read reviews, and find contact details." },
      { property: "og:title", content: "Search Businesses — Kutchi Hub" },
      { property: "og:description", content: "Search Kutchi businesses across categories and cities. Verified listings, reviews and direct contact." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQueryOptions),
  component: SearchPage,
});

function SearchPage() {
  const { q, category, city, sort } = useSearch({ from: "/search" }) as {
    q?: string;
    category?: string;
    city?: string;
    sort?: string;
  };
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);
  const { city: selectedCity } = useCity();
  const initialCity = city ?? selectedCity ?? "";
  const [filters, setFilters] = useState({
    q: q ?? "",
    category: category ?? "",
    city: initialCity,
    sort: sort ?? "relevance",
  });
  const [applied, setApplied] = useState({ q: q ?? "", category: category ?? "", city: initialCity, sort: sort ?? "relevance" });

  // When the header city changes and user hasn't typed a city filter yet, sync it.
  useEffect(() => {
    if (city) return; // URL param wins
    if (!selectedCity) return;
    setFilters((f) => (f.city ? f : { ...f, city: selectedCity }));
    setApplied((a) => (a.city ? a : { ...a, city: selectedCity }));
  }, [selectedCity, city]);

  // Sync URL search params → filter state so clicking a category link
  // (or any other in-page navigation that only changes search params)
  // actually updates the applied query.
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      q: q ?? "",
      category: category ?? "",
      city: city ?? f.city,
      sort: sort ?? "relevance",
    }));
    setApplied((a) => ({
      ...a,
      q: q ?? "",
      category: category ?? "",
      city: city ?? a.city,
      sort: sort ?? "relevance",
    }));
  }, [q, category, city, sort]);

  const [chipDiscount, setChipDiscount] = useState(false);
  const { data: results, isLoading } = useSuspenseQuery(
    searchQueryOptions(applied.q, applied.category, applied.city, applied.sort, chipDiscount),
  );

  const [chipVerified, setChipVerified] = useState(false);
  const [chipOpenNow, setChipOpenNow] = useState(false);
  const [chipTopRated, setChipTopRated] = useState(false);

  const filteredResults = useMemo(() => {
    let list = results ?? [];
    if (chipVerified) list = list.filter((b) => b.verified);
    if (chipTopRated) list = list.filter((b) => (b.avgRating ?? 0) >= 4);
    if (chipOpenNow) {
      list = list.filter((b) => isOpenNow(b.hours) === true);
    }
    return list;
  }, [results, chipVerified, chipOpenNow, chipTopRated]);
  const anyChip = chipVerified || chipOpenNow || chipTopRated || chipDiscount;

  const applyFilters = () => {
    const normalized = {
      q: filters.q,
      category: filters.category === "all" ? "" : filters.category,
      city: filters.city,
      sort: filters.sort,
    };
    setApplied(normalized);
    const params = new URLSearchParams();
    if (normalized.q) params.set("q", normalized.q);
    if (normalized.category) params.set("category", normalized.category);
    if (normalized.city) params.set("city", normalized.city);
    if (normalized.sort) params.set("sort", normalized.sort);
    window.history.replaceState({}, "", `/search?${params.toString()}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Find businesses</h1>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, service, or city"
              className="pl-9"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="relative">
            <Input
              placeholder="City"
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <Button onClick={applyFilters} className="bg-primary text-primary-foreground">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={filters.category} onValueChange={(value) => setFilters((f) => ({ ...f, category: value }))}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.sort} onValueChange={(value) => setFilters((f) => ({ ...f, sort: value }))}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="rating">Top rated</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="discount">Top discount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Quick filters:</span>
        <FilterChip
          active={chipVerified}
          onClick={() => setChipVerified((v) => !v)}
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
          label="Verified"
        />
        <FilterChip
          active={chipDiscount}
          onClick={() => setChipDiscount((v) => !v)}
          icon={<Tag className="h-3.5 w-3.5" />}
          label="Has discount"
        />
        <FilterChip
          active={chipOpenNow}
          onClick={() => setChipOpenNow((v) => !v)}
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Open now"
        />
        <FilterChip
          active={chipTopRated}
          onClick={() => setChipTopRated((v) => !v)}
          icon={<Star className="h-3.5 w-3.5" />}
          label="4★ & above"
        />
        {anyChip && (
          <button
            type="button"
            onClick={() => {
              setChipVerified(false);
              setChipOpenNow(false);
              setChipTopRated(false);
              setChipDiscount(false);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold text-foreground">Categories</h3>
            <CategoryGrid categories={categories} size="sm" />
          </div>
        </aside>

        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `${filteredResults.length} ${filteredResults.length === 1 ? "result" : "results"}${
                    anyChip && results ? ` of ${results.length}` : ""
                  }`}
            </p>
          </div>
          {filteredResults.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResults.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                {anyChip ? "No businesses match these filters. Try clearing some." : "No businesses found matching your search."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-[#ff6a00] bg-[#ff6a00] text-white"
          : "border-border bg-background text-foreground hover:border-[#ff6a00]/40 hover:text-[#ff6a00]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
