import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getBusinessBySlug } from "@/lib/businesses.functions";
import { BusinessDetail } from "@/components/business/BusinessDetail";

const BASE_URL = "https://kutchi-hub.lovable.app";

const businessQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["business", slug],
    queryFn: () => getBusinessBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/business/$slug")({
  head: ({ params, loaderData }) => {
    const b = loaderData?.business;
    const name = b?.name ?? params.slug.replace(/-/g, " ");
    const city = b?.city ?? "";
    const cat = (b as { categories?: { name?: string } } | undefined)?.categories?.name ?? "";
    const rating = loaderData?.avgRating ?? 0;
    const reviewCount = loaderData?.reviewCount ?? 0;
    const title = city ? `${name} — ${cat || "Business"} in ${city} | Kutchi Hub` : `${name} — Kutchi Hub`;
    const desc = b?.description
      ? String(b.description).slice(0, 155)
      : `${name}${cat ? ` · ${cat}` : ""}${city ? ` in ${city}` : ""}. View reviews, hours, phone and directions on Kutchi Hub.`;
    const image = (b as { featured_image_url?: string; featured_image?: string } | undefined)?.featured_image_url
      || (b as { featured_image?: string } | undefined)?.featured_image
      || null;
    const url = `${BASE_URL}/business/${params.slug}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ];
    if (image && image.startsWith("http")) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name,
      description: desc,
      url,
      address: b?.address ? {
        "@type": "PostalAddress",
        streetAddress: b.address,
        addressLocality: city,
        addressRegion: b?.state ?? undefined,
        postalCode: b?.pincode ?? undefined,
        addressCountry: "IN",
      } : undefined,
      telephone: b?.phone ?? undefined,
      image: image ?? undefined,
    };
    if (reviewCount > 0) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount,
      };
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
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
