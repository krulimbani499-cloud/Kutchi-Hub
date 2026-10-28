import { createFileRoute, Link } from "@tanstack/react-router";
import { ListingPageSkeleton } from "@/components/layout/PageSkeleton";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getBannerAdsForCategory, getCityCategoryPageData } from "@/lib/businesses.functions";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { StaticResults } from "@/components/search/StaticResults";
import { CategoryBanner } from "@/components/category/CategoryBanner";
import { BASE_URL, breadcrumbLd, itemListLd, faqLd, ldScript } from "@/lib/seo";

const comboPageOptions = (city: string, category: string) =>
  queryOptions({
    queryKey: ["city-category-page", city, category],
    queryFn: () => getCityCategoryPageData({ data: { city, category } }),
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
    const cityName =
      loaderData?.cityName ??
      params.slug
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
    const catName = loaderData?.category?.name ?? params.category.replace(/-/g, " ");
    const businesses = loaderData?.businesses ?? [];
    const count = businesses.length;
    const title = `Best ${catName} in ${cityName} — Reviews & Contacts | Kutchi Hub`;
    const desc = `Browse ${count > 0 ? count + "+ " : ""}${catName.toLowerCase()} in ${cityName}. Verified reviews, ratings, hours, phone numbers and directions on Kutchi Hub.`;
    const url = `${BASE_URL}/city/${params.slug}/category/${params.category}`;
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
            { name: cityName, url: `/city/${params.slug}` },
            { name: catName, url: `/city/${params.slug}/category/${params.category}` },
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
              q: `How many ${catName.toLowerCase()} are listed in ${cityName}?`,
              a: `Kutchi Hub currently lists ${count} ${catName.toLowerCase()} in ${cityName} with reviews, hours and contact details.`,
            },
            {
              q: `How do I find the best ${catName.toLowerCase()} near me in ${cityName}?`,
              a: `Browse the verified ${catName.toLowerCase()} listings in ${cityName} on Kutchi Hub — sort by rating, check reviews, hours and call directly.`,
            },
          ]),
        ),
      ],
    };
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
  const { cityName, category: cat, businesses } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <ResultsHeader city={cityName} category={cat} total={businesses.length} />
      <p className="-mt-2 mb-4 max-w-3xl text-sm text-muted-foreground">
        Explore {businesses.length}+ verified {cat.name.toLowerCase()} in {cityName} — reviews, ratings, hours, phone numbers and directions.
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          to="/city/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          All in {cityName}
        </Link>
        <Link
          to="/category/$slug"
          params={{ slug: category }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          {cat.name} in all cities
        </Link>
      </div>

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
    </div>
  );
}
