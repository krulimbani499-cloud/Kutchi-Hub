import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { getCategories, searchBusinesses } from "@/lib/businesses.functions";
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
import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

const searchQueryOptions = (q: string, category: string, city: string, sort: string) =>
  queryOptions({
    queryKey: ["search", q, category, city, sort],
    queryFn: () => searchBusinesses({ data: { q, category, city, sort } }),
  });

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Businesses — NearMe" },
      { name: "description", content: "Search for local businesses, read reviews, and find contact details." },
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
  const [filters, setFilters] = useState({
    q: q ?? "",
    category: category ?? "",
    city: city ?? "",
    sort: sort ?? "relevance",
  });
  const [applied, setApplied] = useState({ q: q ?? "", category: category ?? "", city: city ?? "", sort: sort ?? "relevance" });

  const { data: results, isLoading } = useSuspenseQuery(searchQueryOptions(applied.q, applied.category, applied.city, applied.sort));

  const applyFilters = () => {
    setApplied({ ...filters });
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.city) params.set("city", filters.city);
    if (filters.sort) params.set("sort", filters.sort);
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
              <SelectItem value="">All categories</SelectItem>
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
            </SelectContent>
          </Select>
        </div>
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
              {isLoading ? "Loading..." : `${results?.length ?? 0} results found`}
            </p>
          </div>
          {results && results.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No businesses found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
