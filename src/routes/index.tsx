import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/businesses.functions";
import { CategoryGrid } from "@/components/business/CategoryGrid";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import ogImage from "@/assets/nearme-og.jpg";

const homeQueryOptions = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kutchi Hub — Discover Local Businesses" },
      { name: "description", content: "Find the best restaurants, hospitals, salons, hotels and more near you." },
      { property: "og:title", content: "Kutchi Hub — Discover Local Businesses" },
      { property: "og:description", content: "Find the best restaurants, hospitals, salons, hotels and more near you." },
      { property: "og:image", content: ogImage },
      { name: "twitter:image", content: ogImage },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQueryOptions),
  component: HomePage,
});

function HomePage() {
  const { data: home } = useSuspenseQuery(homeQueryOptions);
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col">
      <section className="bg-hero py-12 text-hero-foreground">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Find local businesses near you</h1>
          <p className="mt-3 text-base opacity-90">
            Restaurants, hospitals, salons, hotels, groceries — all in one place.
          </p>
          <form
            className="mt-6 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(search.trim())}`;
              }
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 opacity-60" />
              <Input
                type="search"
                placeholder="What are you looking for?"
                className="h-12 border-0 bg-white pl-11 text-foreground placeholder:text-muted-foreground"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="City or location"
                className="h-12 border-0 bg-white pl-11 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button type="submit" className="h-12 bg-primary-foreground px-8 text-foreground hover:bg-white/90">
              Search
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Popular Categories</h2>
          <Link to="/categories" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <CategoryGrid categories={home.categories} />
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Featured Listings</h2>
          <Link to="/search" className="text-sm font-medium text-primary hover:underline">
            Browse all
          </Link>
        </div>
        {home.featured.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {home.featured.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No featured listings yet. Add your business today!</p>
            <Button className="mt-4 bg-primary text-primary-foreground" asChild>
              <Link to="/business/new">Add a business</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="rounded-2xl bg-primary px-6 py-8 text-primary-foreground sm:px-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">Own a business?</h2>
              <p className="mt-1 opacity-90">List your business on Kutchi Hub and reach thousands of customers.</p>
            </div>
            <Button size="lg" className="bg-primary-foreground text-foreground hover:bg-white/90" asChild>
              <Link to="/business/new">Add your business</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
