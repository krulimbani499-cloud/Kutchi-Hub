import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCategoryPageData } from "@/lib/businesses.functions";
import { BusinessCard } from "@/components/business/BusinessCard";
import { MapPin } from "lucide-react";
import { BASE_URL, breadcrumbLd, itemListLd, ldScript } from "@/lib/seo";

const categoryPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["category-page", slug],
    queryFn: () => getCategoryPageData({ data: { slug } }),
  });

export const Route = createFileRoute("/category/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(categoryPageOptions(params.slug)),
  head: ({ params, loaderData }) => {
    const name = loaderData?.category?.name ?? params.slug.replace(/-/g, " ");
    const businesses = loaderData?.businesses ?? [];
    const count = businesses.length;
    const topCity = loaderData?.cities?.[0];
    const title = topCity
      ? `Best ${name} in ${topCity} — Reviews & Contacts | Kutchi Hub`
      : `Best ${name} — Reviews, Ratings & Contacts | Kutchi Hub`;
    const desc = `Browse ${count > 0 ? count + "+ " : ""}${name.toLowerCase()} listings${topCity ? ` in ${topCity}` : ""}. Verified reviews, ratings, hours, phone numbers and directions on Kutchi Hub.`;
    const url = `${BASE_URL}/category/${params.slug}`;
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
            { name: "Categories", url: "/categories" },
            { name, url: `/category/${params.slug}` },
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
      ],
    };
  },
  component: CategoryPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Category not found</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
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
  const { category, businesses, cities } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>›</span>
        <Link to="/categories" className="hover:text-foreground">Categories</Link>
        <span>›</span>
        <span className="text-foreground">{category.name}</span>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <h1 className="text-3xl font-extrabold text-foreground">{category.name}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Discover verified {category.name.toLowerCase()} businesses on Kutchi Hub. {businesses.length}+ listings with reviews, hours and contact info.
        </p>
        {cities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cities.slice(0, 10).map((c) => (
              <Link
                key={c}
                to="/city/$slug/category/$category"
                params={{
                  slug: c
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, ""),
                  category: category.slug,
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                <MapPin className="h-3 w-3" /> {c}
              </Link>
            ))}
          </div>
        )}
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No {category.name.toLowerCase()} listings yet.{" "}
          <Link to="/list-your-business" className="text-primary underline">List yours first</Link>
        </div>
      ) : (
        <>
          <h2 className="mb-4 text-lg font-semibold text-foreground">{businesses.length} listings</h2>
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