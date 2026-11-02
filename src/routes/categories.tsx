import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCategoriesWithCounts } from "@/lib/businesses.functions";
import { CategoryGrid } from "@/components/business/CategoryGrid";
import { useCity } from "@/hooks/useCity";
import { BASE_URL } from "@/lib/seo";

// Every category with its number of published businesses: for the selected city, or all cities (city undefined).
const categoriesQueryOptions = (city?: string) =>
  queryOptions({
    queryKey: ["categories-with-counts", city ?? null],
    queryFn: () => getCategoriesWithCounts({ data: { city } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "All Business Categories — Kutchi Hub" },
      { name: "description", content: "Browse every business category on Kutchi Hub — restaurants, doctors, grocery, shops, services and more. Find verified local listings with reviews." },
      { property: "og:title", content: "All Business Categories — Kutchi Hub" },
      { property: "og:description", content: "Browse every business category on Kutchi Hub — verified local listings with reviews, contact info and directions." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/categories` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/categories` }],
  }),
  // The server does not know the visitor's city, so the page itself is rendered with the all-cities numbers; the city's numbers load after.
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQueryOptions()),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { city } = useCity();
  const { data: all } = useSuspenseQuery(categoriesQueryOptions());
  const { data: inCity } = useQuery({ ...categoriesQueryOptions(city ?? undefined), enabled: !!city });

  // A city is picked: its own numbers (and its own order). Until they arrive no number is shown, so a wrong one never flashes.
  const categories = useMemo(() => {
    if (!city) return all;
    if (inCity) return inCity;
    return all.map(({ businessCount: _n, ...rest }) => rest);
  }, [city, all, inCity]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">All Categories</h1>
      <p className="mb-6 text-muted-foreground">Explore businesses by category.</p>
      <CategoryGrid categories={categories} />
    </div>
  );
}
