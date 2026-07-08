import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCityCategoryPageData } from "@/lib/businesses.functions";
import { BusinessCard } from "@/components/business/BusinessCard";
import { BASE_URL, breadcrumbLd, itemListLd, faqLd, ldScript } from "@/lib/seo";

const comboPageOptions = (city: string, category: string) =>
  queryOptions({
    queryKey: ["city-category-page", city, category],
    queryFn: () => getCityCategoryPageData({ data: { city, category } }),
  });

export const Route = createFileRoute("/city/$slug/category/$category")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(comboPageOptions(params.slug, params.category)),
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
  component: CityCategoryPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page unavailable</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
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
  const { cityName, category: cat, businesses } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span>›</span>
        <Link to="/city/$slug" params={{ slug }} className="hover:text-foreground">
          {cityName}
        </Link>
        <span>›</span>
        <span className="text-foreground">{cat.name}</span>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <h1 className="text-3xl font-extrabold text-foreground">
          Best {cat.name} in {cityName}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Explore {businesses.length}+ verified {cat.name.toLowerCase()} in {cityName} — reviews, ratings, hours, phone
          numbers and directions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No {cat.name.toLowerCase()} listings in {cityName} yet.{" "}
          <Link to="/list-your-business" className="text-primary underline">
            Be the first to list
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {businesses.length} {cat.name.toLowerCase()} in {cityName}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}