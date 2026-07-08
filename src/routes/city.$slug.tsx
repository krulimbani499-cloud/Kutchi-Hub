import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCityPageData } from "@/lib/businesses.functions";
import { BusinessCard } from "@/components/business/BusinessCard";
import { BASE_URL, breadcrumbLd, itemListLd, faqLd, ldScript } from "@/lib/seo";

const cityPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["city-page", slug],
    queryFn: () => getCityPageData({ data: { slug } }),
  });

export const Route = createFileRoute("/city/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(cityPageOptions(params.slug)),
  head: ({ params, loaderData }) => {
    const name = loaderData?.cityName ?? params.slug.replace(/-/g, " ");
    const businesses = loaderData?.businesses ?? [];
    const count = businesses.length;
    const title = `Top Businesses in ${name} — Reviews & Contacts | Kutchi Hub`;
    const desc = `Discover ${count > 0 ? count + "+ " : ""}businesses in ${name} — restaurants, doctors, salons, shops and services. Reviews, hours, phone numbers and directions.`;
    const url = `${BASE_URL}/city/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        ldScript(
          breadcrumbLd([
            { name: "Home", url: "/" },
            { name, url: `/city/${params.slug}` },
          ]),
        ),
        ldScript(
          itemListLd(
            businesses.slice(0, 20).map((b) => ({
              name: b.name,
              url: `/business/${b.slug}`,
            })),
          ),
        ),
        ldScript(
          faqLd([
            {
              q: `How many businesses are listed in ${name} on Kutchi Hub?`,
              a: `Kutchi Hub currently has ${count} verified business listings in ${name} across multiple categories.`,
            },
            {
              q: `How do I add my business in ${name}?`,
              a: `Visit the "List Your Business" page on Kutchi Hub to add your ${name} business. Listings include reviews, hours, contact info and directions.`,
            },
          ]),
        ),
      ],
    };
  },
  component: CityPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">City page unavailable</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <Link to="/search" className="mt-4 inline-block text-primary underline">Search all businesses</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">City not found</h1>
      <Link to="/search" className="mt-4 inline-block text-primary underline">Search businesses</Link>
    </div>
  ),
});

function CityPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(cityPageOptions(slug));
  const { cityName, businesses, categories } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>›</span>
        <span className="text-foreground">{cityName}</span>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <h1 className="text-3xl font-extrabold text-foreground">Businesses in {cityName}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Explore {businesses.length}+ businesses across {categories.length} categories in {cityName}.
        </p>
        {categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.slice(0, 12).map((c) => (
              <Link
                key={c.slug}
                to="/city/$slug/category/$category"
                params={{ slug, category: c.slug }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                {c.name} <span className="text-muted-foreground">({c.count})</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No listings in {cityName} yet.{" "}
          <Link to="/list-your-business" className="text-primary underline">Be the first to list</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}