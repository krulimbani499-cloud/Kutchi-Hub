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
      { title: "Categories — Kutchi Hub" },
      { name: "description", content: "Browse businesses by category on Kutchi Hub." },
    ],
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
