import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCategories } from "@/lib/businesses.functions";
import { CategoryGrid } from "@/components/business/CategoryGrid";

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "All Business Categories — Kutchi Hub" },
      { name: "description", content: "Browse every business category on Kutchi Hub — restaurants, doctors, grocery, shops, services and more. Find verified local listings with reviews." },
      { property: "og:title", content: "All Business Categories — Kutchi Hub" },
      { property: "og:description", content: "Browse every business category on Kutchi Hub — verified local listings with reviews, contact info and directions." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kutchi-hub.lovable.app/categories" },
    ],
    links: [{ rel: "canonical", href: "https://kutchi-hub.lovable.app/categories" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQueryOptions),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">All Categories</h1>
      <p className="mb-6 text-muted-foreground">Explore businesses by category.</p>
      <CategoryGrid categories={categories} />
    </div>
  );
}
