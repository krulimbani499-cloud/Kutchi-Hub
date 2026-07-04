import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/businesses.functions";
import { CategoryGrid } from "@/components/business/CategoryGrid";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2, TrendingUp, Phone, Star, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import ogImage from "@/assets/kutchi-hub-og.jpg";
import { CitySelector } from "@/components/layout/CitySelector";
import { useCity } from "@/hooks/useCity";

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
  const { city } = useCity();

  const trending = [
    "Restaurants",
    "Doctors",
    "Beauty Salons",
    "Hotels",
    "Gyms",
    "Schools",
    "Grocery Stores",
    "Car Repair",
  ];

  const submitSearch = (q?: string) => {
    const params = new URLSearchParams();
    const term = (q ?? search).trim();
    if (term) params.set("q", term);
    if (city) params.set("city", city);
    window.location.href = `/search?${params.toString()}`;
  };

  return (
    <div className="flex flex-col">
      {/* Hero — JustDial-style */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-orange-500 to-orange-600 py-14 text-white sm:py-20">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto max-w-5xl px-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Kutchi Hub — Your Local Search Engine
          </h1>
          <p className="mt-3 text-base opacity-95 sm:text-lg">
            Find restaurants, doctors, salons, hotels, gyms and thousands more — right in your city.
          </p>

          {/* Pill search */}
          <form
            className="mx-auto mt-8 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white p-1.5 shadow-2xl sm:flex-row sm:rounded-full sm:p-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 sm:rounded-full">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <CitySelector compact className="w-full justify-start bg-transparent px-0 text-foreground hover:bg-transparent" />
              </div>
            </div>
            <div className="hidden w-px bg-border sm:block" />
            <div className="relative flex flex-1 items-center rounded-xl bg-white px-3 sm:rounded-full">
              <Search className="h-5 w-5 shrink-0 text-primary" />
              <Input
                type="search"
                placeholder="Search for restaurants, salons, doctors..."
                className="h-11 flex-1 border-0 bg-transparent text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="ml-0 mt-2 h-12 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:ml-2 sm:mt-0 sm:rounded-full"
            >
              <Search className="mr-1.5 h-4 w-4" /> Search
            </Button>
          </form>

          {/* Trending chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold opacity-90">
              <TrendingUp className="h-4 w-4" /> Trending:
            </span>
            {trending.map((t) => (
              <button
                key={t}
                onClick={() => submitSearch(t)}
                className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Trust bar */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="flex items-center justify-center gap-2 opacity-95">
              <Building2 className="h-5 w-5" /> <span>10K+ Businesses</span>
            </div>
            <div className="flex items-center justify-center gap-2 opacity-95">
              <Star className="h-5 w-5 fill-white" /> <span>Verified Reviews</span>
            </div>
            <div className="flex items-center justify-center gap-2 opacity-95">
              <ShieldCheck className="h-5 w-5" /> <span>Trusted Locally</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories — big tiled grid */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">Popular Categories</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {city ? `Explore top picks in ${city}` : "Browse services across every corner"}
            </p>
          </div>
          <Link to="/categories" className="text-sm font-semibold text-primary hover:underline">
            View all →
          </Link>
        </div>
        <CategoryGrid categories={home.categories} />
      </section>

      {/* Quick actions row — JD-style */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction icon={Phone} title="Call & Book" desc="Instant contact with businesses" />
          <QuickAction icon={Star} title="Verified Reviews" desc="Real ratings from real customers" />
          <QuickAction icon={MapPin} title="Near You" desc="Location-aware discovery" />
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">Featured Businesses</h2>
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

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-orange-500 px-6 py-10 text-primary-foreground shadow-xl sm:px-12">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">Own a business?</h2>
              <p className="mt-2 max-w-lg opacity-95">
                List free on Kutchi Hub and get discovered by thousands of local customers every day.
              </p>
            </div>
            <Button size="lg" className="bg-white text-primary hover:bg-white/95" asChild>
              <Link to="/business/new">List Your Business — Free</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickAction({ icon: Icon, title, desc }: { icon: typeof Phone; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
