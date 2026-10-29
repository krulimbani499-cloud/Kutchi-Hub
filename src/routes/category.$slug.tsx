import { createFileRoute, Link } from "@tanstack/react-router";
import { ListingPageSkeleton } from "@/components/layout/PageSkeleton";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getBannerAdsForCategory, getCategoryPageData } from "@/lib/businesses.functions";
import { CategoryBanner } from "@/components/category/CategoryBanner";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { StaticResults } from "@/components/search/StaticResults";
import { CityChip, LandingFaq, LandingIntro, LinkChips } from "@/components/search/LandingContent";
import { categoryCopy, landingFacts, landingHead, parseKeywords } from "@/lib/seo-landing";

const categoryPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["category-page", slug],
    queryFn: () => getCategoryPageData({ data: { slug } }),
  });

type CategoryData = Awaited<ReturnType<typeof getCategoryPageData>>;

/** The wording of the page (title, description, intro, FAQ) from its data: the head and the page read the same text. */
const copyFor = (d: CategoryData) =>
  categoryCopy({
    category: d.category.name,
    facts: landingFacts(d.businesses, d.total),
    cities: d.cityLinks,
    keywords: parseKeywords(d.keywords),
  });

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(categoryPageOptions(params.slug));
    // Does this category have a banner in ANY city? The banner shown to a visitor depends on their saved city (known only in the
    // browser), but whether to keep room for it is known here, so the page does not jump when it arrives.
    const anyBanners = await getBannerAdsForCategory({ data: { categoryId: data.category.id } }).then((b) => b.length > 0).catch(() => false);
    return { ...data, anyBanners };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return {};
    const path = `/category/${loaderData.category.slug || params.slug}`;
    return landingHead({
      copy: copyFor(loaderData),
      path,
      empty: loaderData.total === 0,
      crumbs: [
        { name: "Home", url: "/" },
        { name: "Categories", url: "/categories" },
        { name: loaderData.category.name, url: path },
      ],
      items: loaderData.businesses.map((b) => ({ name: b.name, url: `/business/${b.slug}` })),
    });
  },
  pendingComponent: ListingPageSkeleton,
  component: CategoryPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Category not found</h1>
      <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <Link to="/categories" className="mt-4 inline-block text-primary underline">Browse all categories</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Category not found</h1>
      <Link to="/categories" className="mt-4 inline-block text-primary underline">Browse all categories</Link>
    </div>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(categoryPageOptions(slug));
  const { category, businesses, cityLinks, total } = data;
  const { anyBanners } = Route.useLoaderData();
  const copy = copyFor(data);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <ResultsHeader category={category} total={total} landing={{ categories: true }} />
      {total > 0 && <LandingIntro paragraphs={copy.intro} />}

      {cityLinks.length > 0 && (
        <LinkChips title={`${category.name} by city`}>
          {cityLinks.slice(0, 24).map((c) => (
            <CityChip key={c.slug} slug={c.slug} category={category.slug} name={c.name} count={c.count} />
          ))}
        </LinkChips>
      )}

      <StaticResults
        businesses={businesses}
        category={category}
        filterSearch={{ category: category.slug }}
        banner={<CategoryBanner categoryId={category.id} reserveSpace={anyBanners} />}
        empty={
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No {category.name.toLowerCase()} listings yet.{" "}
            <Link to="/business/new" className="text-primary underline">List yours first</Link>
          </div>
        }
      />

      {total > 0 && <LandingFaq faq={copy.faq} />}
    </div>
  );
}
