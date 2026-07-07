import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCategoryPageData } from "@/lib/businesses.functions";
import { BusinessCard } from "@/components/business/BusinessCard";
import { MapPin } from "lucide-react";

const BASE_URL = "https://kutchi-hub.lovable.app";

const categoryPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["category-page", slug],
    queryFn: () => getCategoryPageData({ data: { slug } }),
  });

export const Route = createFileRoute("/category/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(categoryPageOptions(params.slug)),
  head: ({ params, loaderData }) => {
    const name = loaderData?.category?.name ?? params.slug.replace(/-/g, " ");
    const count = loaderData?.businesses.length ?? 0;
    const title = `${name} Businesses in India — Kutchi Hub`;
    const desc = `Browse ${count > 0 ? count + "+ " : ""}${name.toLowerCase()} businesses on Kutchi Hub. Verified listings, reviews, contact details and directions.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${BASE_URL}/category/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `${BASE_URL}/category/${params.slug}` }],
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
                to="/search"
                search={{ category: category.slug, city: c }}
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