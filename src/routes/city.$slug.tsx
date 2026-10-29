import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { ListingPageSkeleton } from "@/components/layout/PageSkeleton";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCityPageData } from "@/lib/businesses.functions";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { StaticResults } from "@/components/search/StaticResults";
import { CategoryChip, LandingFaq, LandingIntro, LinkChips } from "@/components/search/LandingContent";
import { cityCopy, landingFacts, landingHead } from "@/lib/seo-landing";

const cityPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["city-page", slug],
    queryFn: () => getCityPageData({ data: { slug } }),
  });

type CityData = Awaited<ReturnType<typeof getCityPageData>>;

/** The wording of the page (title, description, intro, FAQ) from its data: the head and the page read the same text. */
const copyFor = (d: CityData) => cityCopy({ city: d.cityName, facts: landingFacts(d.businesses, d.total, d.cityName), categories: d.categories });

export const Route = createFileRoute("/city/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(cityPageOptions(params.slug)),
  head: ({ params, loaderData, matches }) => {
    // This route is also the parent of /city/<city>/category/<category>: that page writes its own head.
    if (!loaderData || (matches as Array<{ routeId: string }>).some((m) => m.routeId === "/city/$slug/category/$category")) return {};
    const path = `/city/${loaderData.citySlug || params.slug}`;
    return landingHead({
      copy: copyFor(loaderData),
      path,
      empty: loaderData.total === 0,
      crumbs: [
        { name: "Home", url: "/" },
        { name: loaderData.cityName, url: path },
      ],
      items: loaderData.businesses.map((b) => ({ name: b.name, url: `/business/${b.slug}` })),
    });
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
  const { cityName, citySlug, businesses, categories, total } = data;
  const copy = copyFor(data);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <ResultsHeader city={cityName} total={total} landing={{ citySlug }} heading={`Top Businesses in ${cityName}`} />
      {total > 0 && <LandingIntro paragraphs={copy.intro} />}
      {categories.length > 0 && (
        <LinkChips title={`Browse ${cityName} by category`}>
          {categories.map((c) => (
            <CategoryChip key={c.slug} citySlug={citySlug} slug={c.slug} name={c.name} count={c.count} />
          ))}
        </LinkChips>
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

      {total > 0 && <LandingFaq faq={copy.faq} />}
    </div>
  );
}
