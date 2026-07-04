import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getBusinessBySlug } from "@/lib/businesses.functions";
import { BusinessDetail } from "@/components/business/BusinessDetail";

const businessQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["business", slug],
    queryFn: () => getBusinessBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/business/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Kutchi Hub` },
      { name: "description", content: "View business details, reviews, and contact information on Kutchi Hub." },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(businessQueryOptions(params.slug)),
  component: BusinessPage,
});

function BusinessPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(businessQueryOptions(slug));

  return (
    <BusinessDetail
      business={data.business}
      reviews={data.reviews}
      photos={data.photos}
      avgRating={data.avgRating}
      reviewCount={data.reviewCount}
    />
  );
}
