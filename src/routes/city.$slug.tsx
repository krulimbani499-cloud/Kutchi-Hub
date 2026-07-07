import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCityPageData } from "@/lib/businesses.functions";
import { BusinessCard } from "@/components/business/BusinessCard";

const BASE_URL = "https://kutchi-hub.lovable.app";

const cityPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["city-page", slug],
    queryFn: () => getCityPageData({ data: { slug } }),
  });

export const Route = createFileRoute("/city/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(cityPageOptions(params.slug)),
  head: ({ params, loaderData }) => {
    const name = loaderData?.cityName ?? params.slug.replace(/-/g, " ");
    const count = loaderData?.businesses.length ?? 0;
    const title = `Businesses in ${name} — Kutchi Hub`;
    const desc = `Find ${count > 0 ? count + "+ " : ""}businesses in ${name}. Restaurants, shops, services and more — reviews, contact info and directions.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${BASE_URL}/city/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `${BASE_URL}/city/${params.slug}` }],
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
                to="/search"
                search={{ category: c.slug, city: cityName }}
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