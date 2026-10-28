import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { ListingPageSkeleton } from "@/components/layout/PageSkeleton";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCityPageData } from "@/lib/businesses.functions";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { StaticResults } from "@/components/search/StaticResults";
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
    const desc = `Discover ${count > 0 ? count + "+ " : ""}businesses in ${name} — restaurants, doctors, grocery, shops and services. Reviews, hours, phone numbers and directions.`;
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
  pendingComponent: ListingPageSkeleton,
  component: CityPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">City page unavailable</h1>
      <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
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

/** /city/<city> is also the parent of /city/<city>/category/<category>: when that child page is open, it is shown instead. */
function CityPage() {
  const child = useChildMatches();
  return child.length > 0 ? <Outlet /> : <CityIndex />;
}

function CityIndex() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(cityPageOptions(slug));
  const { cityName, businesses, categories } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <ResultsHeader city={cityName} total={businesses.length} />
      <p className="-mt-2 mb-4 max-w-3xl text-sm text-muted-foreground">
        Explore {businesses.length}+ businesses across {categories.length} categories in {cityName}.
      </p>
      {categories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
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

      <StaticResults
        businesses={businesses}
        city={cityName}
        filterSearch={{ city: cityName }}
        empty={
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No listings in {cityName} yet.{" "}
            <Link to="/business/new" className="text-primary underline">Be the first to list</Link>
          </div>
        }
      />
    </div>
  );
}
