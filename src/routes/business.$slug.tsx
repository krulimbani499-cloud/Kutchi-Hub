import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getBusinessBySlug } from "@/lib/businesses.functions";
import { BusinessDetail } from "@/components/business/BusinessDetail";
import { BASE_URL, breadcrumbLd, ldScript } from "@/lib/seo";

const businessQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["business", slug],
    queryFn: () => getBusinessBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/business/$slug")({
  head: ({ params, loaderData }) => {
    const ld = loaderData as
      | {
          business?: {
            name?: string;
            city?: string;
            state?: string;
            pincode?: string;
            address?: string;
            phone?: string;
            description?: string;
            featured_image?: string;
            featured_image_url?: string;
            latitude?: number | null;
            longitude?: number | null;
            hours?: Record<string, string> | null;
            website?: string | null;
            instagram_url?: string | null;
            facebook_url?: string | null;
            youtube_url?: string | null;
            price_range?: string | null;
            categories?: { name?: string } | null;
          };
          avgRating?: number;
          reviewCount?: number;
          reviews?: Array<{ rating: number; comment: string | null; created_at: string; profiles?: { display_name: string | null } | null }>;
        }
      | undefined;
    const b = ld?.business;
    const name = b?.name ?? params.slug.replace(/-/g, " ");
    const city = b?.city ?? "";
    const cat = b?.categories?.name ?? "";
    const rating = ld?.avgRating ?? 0;
    const reviewCount = ld?.reviewCount ?? 0;
    const title = city ? `${name} — ${cat || "Business"} in ${city} | Kutchi Hub` : `${name} — Kutchi Hub`;
    const desc = b?.description
      ? String(b.description).slice(0, 155)
      : `${name}${cat ? ` · ${cat}` : ""}${city ? ` in ${city}` : ""}. View reviews, hours, phone and directions on Kutchi Hub.`;
    const image = b?.featured_image_url || b?.featured_image || null;
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
    if (typeof b?.latitude === "number" && typeof b?.longitude === "number") {
      jsonLd.geo = { "@type": "GeoCoordinates", latitude: b.latitude, longitude: b.longitude };
    }
    if (b?.price_range) {
      jsonLd.priceRange = b.price_range;
    }
    const sameAs = [b?.website, b?.instagram_url, b?.facebook_url, b?.youtube_url].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    if (sameAs.length > 0) jsonLd.sameAs = sameAs;
    if (b?.hours && typeof b.hours === "object") {
      const dayMap: Record<string, string> = {
        mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
        fri: "Friday", sat: "Saturday", sun: "Sunday",
      };
      const specs: Array<Record<string, string>> = [];
      for (const [key, val] of Object.entries(b.hours as Record<string, string>)) {
        const day = dayMap[key.toLowerCase().slice(0, 3)];
        if (!day || !val || /closed/i.test(val)) continue;
        const m = String(val).match(/(\d{1,2}:?\d{0,2})\s*[-–—to]+\s*(\d{1,2}:?\d{0,2})/i);
        if (m) {
          specs.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: day,
            opens: m[1].includes(":") ? m[1] : `${m[1]}:00`,
            closes: m[2].includes(":") ? m[2] : `${m[2]}:00`,
          });
        }
      }
      if (specs.length > 0) jsonLd.openingHoursSpecification = specs;
    }
    if (reviewCount > 0) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount,
      };
    }
    const topReviews = (ld?.reviews ?? []).slice(0, 5).filter((r) => r.comment);
    if (topReviews.length > 0) {
      jsonLd.review = topReviews.map((r) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
        author: { "@type": "Person", name: r.profiles?.display_name ?? "Customer" },
        reviewBody: r.comment,
        datePublished: r.created_at,
      }));
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        ldScript(jsonLd),
        ldScript(
          breadcrumbLd([
            { name: "Home", url: "/" },
            ...(cat ? [{ name: cat, url: "/categories" }] : []),
            ...(city ? [{ name: city, url: `/city/${city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}` }] : []),
            { name, url: `/business/${params.slug}` },
          ]),
        ),
      ],
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
