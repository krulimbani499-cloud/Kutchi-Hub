import { createFileRoute, Link } from "@tanstack/react-router";
import { ListingPageSkeleton } from "@/components/layout/PageSkeleton";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getBannerAdsForCategory, getCityCategoryPageData } from "@/lib/businesses.functions";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { StaticResults } from "@/components/search/StaticResults";
import { CategoryChip, CityChip, LandingFaq, LandingIntro, LinkChips } from "@/components/search/LandingContent";
import { CategoryBanner } from "@/components/category/CategoryBanner";
import { comboCopy, landingFacts, landingHead, parseKeywords } from "@/lib/seo-landing";

const comboPageOptions = (city: string, category: string) =>
  queryOptions({
    queryKey: ["city-category-page", city, category],
    queryFn: () => getCityCategoryPageData({ data: { city, category } }),
  });

type ComboData = Awaited<ReturnType<typeof getCityCategoryPageData>>;

/** The wording of the page (title, description, intro, FAQ) from its data: the head and the page read the same text. */
const copyFor = (d: ComboData) =>
  comboCopy({
    category: d.category.name,
    city: d.cityName,
    facts: landingFacts(d.businesses, d.total, d.cityName),
    keywords: parseKeywords(d.keywords),
  });

export const Route = createFileRoute("/city/$slug/category/$category")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(comboPageOptions(params.slug, params.category));
    // The category banner is loaded with the page (it needs the category id): it is in the server-rendered page and in the
    // page data, so it never pops in later and pushes the list down. A failing banner never breaks the page.
    const banners = await getBannerAdsForCategory({ data: { categoryId: data.category.id, city: data.cityName } }).catch(() => []);
    return { ...data, banners };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return {};
    const cityPath = `/city/${loaderData.citySlug || params.slug}`;
    const path = `${cityPath}/category/${loaderData.category.slug || params.category}`;
    return landingHead({
      copy: copyFor(loaderData),
      path,
      empty: loaderData.total === 0,
      crumbs: [
        { name: "Home", url: "/" },
        { name: loaderData.cityName, url: cityPath },
        { name: loaderData.category.name, url: path },
      ],
      items: loaderData.businesses.map((b) => ({ name: b.name, url: `/business/${b.slug}` })),
    });
  },
  pendingComponent: ListingPageSkeleton,
  component: CityCategoryPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page unavailable</h1>
      <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <Link to="/categories" className="mt-4 inline-block text-primary underline">
        Browse all categories
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <Link to="/categories" className="mt-4 inline-block text-primary underline">
        Browse all categories
      </Link>
    </div>
  ),
});

function CityCategoryPage() {
  const { slug, category } = Route.useParams();
  const { data } = useSuspenseQuery(comboPageOptions(slug, category));
  const { banners } = Route.useLoaderData();
  const { cityName, citySlug, category: cat, businesses, total, otherCategories, otherCities } = data;
  const copy = copyFor(data);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <ResultsHeader city={cityName} category={cat} total={total} landing={{ citySlug }} />
      {total > 0 && <LandingIntro paragraphs={copy.intro} />}
      <div className="mb-5 flex flex-wrap gap-2">
        <CityChip slug={citySlug} name={`All businesses in ${cityName}`} />
        <Link
          to="/category/$slug"
          params={{ slug: cat.slug }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          {cat.name} in all cities
        </Link>
      </div>
      {otherCategories.length > 0 && (
        <LinkChips title={`More in ${cityName}`}>
          {otherCategories.map((c) => (
            <CategoryChip key={c.slug} citySlug={citySlug} slug={c.slug} name={c.name} count={c.count} />
          ))}
        </LinkChips>
      )}

      <StaticResults
        businesses={businesses}
        category={cat}
        city={cityName}
        filterSearch={{ category: cat.slug, city: cityName }}
        banner={<CategoryBanner categoryId={cat.id} city={cityName} initialBanners={banners} />}
        empty={
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No {cat.name.toLowerCase()} listings in {cityName} yet.{" "}
            <Link to="/business/new" className="text-primary underline">
              Be the first to list
            </Link>
          </div>
        }
      />

      {otherCities.length > 0 && (
        <div className="mt-8">
          <LinkChips title={`${cat.name} in other cities`}>
            {otherCities.map((c) => (
              <CityChip key={c.slug} slug={c.slug} category={cat.slug} name={c.name} count={c.count} />
            ))}
          </LinkChips>
        </div>
      )}

      {total > 0 && <LandingFaq faq={copy.faq} />}
    </div>
  );
}
