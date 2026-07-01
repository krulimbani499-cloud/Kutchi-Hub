import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCategories } from "@/lib/businesses.functions";
import { BusinessForm } from "@/components/business/BusinessForm";

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

export const Route = createFileRoute("/_authenticated/business/new")({
  head: () => ({
    meta: [
      { title: "Add Business — NearMe" },
      { name: "description", content: "Add your business to NearMe directory." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQueryOptions),
  component: NewBusinessPage,
});

function NewBusinessPage() {
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Add a Business</h1>
      <p className="mb-6 text-muted-foreground">List your business on NearMe and start reaching customers.</p>
      <div className="rounded-2xl border border-border bg-card p-6">
        <BusinessForm categories={categories} />
      </div>
    </div>
  );
}
