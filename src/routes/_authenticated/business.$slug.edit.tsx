import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCategories, getBusinessBySlug } from "@/lib/businesses.functions";
import { BusinessForm } from "@/components/business/BusinessForm";

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

const editBusinessQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["edit-business", slug],
    queryFn: () => getBusinessBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/_authenticated/business/$slug/edit")({
  head: () => ({
    meta: [
      { title: "Edit Business — Kutchi Hub" },
      { name: "description", content: "Update your business information on Kutchi Hub." },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(categoriesQueryOptions);
    await context.queryClient.ensureQueryData(editBusinessQueryOptions(params.slug));
  },
  component: EditBusinessPage,
});

function EditBusinessPage() {
  const { slug } = Route.useParams();
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);
  const { data } = useSuspenseQuery(editBusinessQueryOptions(slug));

  if (!data.business) throw notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Edit Business</h1>
      <p className="mb-6 text-muted-foreground">Update your business details below.</p>
      <div className="rounded-2xl border border-border bg-card p-6">
        <BusinessForm categories={categories} initial={data.business} photos={data.photos} />
      </div>
    </div>
  );
}
