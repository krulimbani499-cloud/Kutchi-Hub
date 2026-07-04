import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/businesses.functions";
import { CategoryGrid } from "@/components/business/CategoryGrid";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2, Mic, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import ogImage from "@/assets/kutchi-hub-og.jpg";
import { CitySelector } from "@/components/layout/CitySelector";
import { MarketingBanner } from "@/components/home/MarketingBanner";
import tileB2B from "@/assets/tile-b2b.jpg";
import tileRepairs from "@/assets/tile-repairs.jpg";
import tileRealEstate from "@/assets/tile-realestate.jpg";
import tileDoctors from "@/assets/tile-doctors.jpg";
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

  const submitSearch = (q?: string) => {
    const params = new URLSearchParams();
    const term = (q ?? search).trim();
    if (term) params.set("q", term);
    if (city) params.set("city", city);
    window.location.href = `/search?${params.toString()}`;
  };

  const featureTiles = [
    { title: "B2B", subtitle: "Quick Quotes", bg: "from-blue-500 to-blue-600", img: tileB2B },
    { title: "Repairs & Services", subtitle: "Get Nearest Vendor", bg: "from-slate-700 to-slate-900", img: tileRepairs },
    { title: "Real Estate", subtitle: "Finest Agents", bg: "from-indigo-500 to-indigo-700", img: tileRealEstate },
    { title: "Doctors", subtitle: "Book Now", bg: "from-emerald-500 to-emerald-700", img: tileDoctors },
  ];

  return (
    <div className="flex flex-col bg-muted/30">
      {/* Search header — JustDial-style, clean white */}
      <section className="bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
            Search across{" "}
            <span className="text-[#ff6a00]">10,000+</span>{" "}
            <span className="text-[#ff6a00]">Kutchi Businesses</span>
          </h1>

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <div className="flex h-12 w-full items-center rounded-md border border-border bg-background px-1 sm:w-72">
              <CitySelector compact className="w-full justify-start bg-transparent px-2 text-foreground hover:bg-transparent" />
            </div>
            <div className="relative flex h-12 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
              <Input
                type="search"
                placeholder="Search for restaurants, doctors, salons..."
                className="h-11 flex-1 border-0 bg-transparent text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Mic className="h-5 w-5 shrink-0 text-primary" />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-10 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Location-aware sponsored banner */}
      <MarketingBanner />

      {/* Promo banner + feature tiles row */}
      <section className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Promo banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-100 to-orange-50 p-6 sm:p-8">
            <div className="max-w-[70%]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#ff6a00]">Featured</p>
              <h3 className="mt-1 text-lg font-extrabold text-foreground sm:text-2xl">
                List Your Business
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get discovered by thousands of Kutchi customers every day.
              </p>
              <Button size="sm" className="mt-4 rounded-full bg-[#ff6a00] text-white hover:bg-[#e65a00]" asChild>
                <Link to="/business/new">
                  Get Started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Building2 className="absolute -right-4 -bottom-4 h-40 w-40 text-orange-200" />
          </div>

          {/* Feature tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featureTiles.map((t) => (
              <Link
                key={t.title}
                to="/categories"
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${t.bg} p-4 text-white transition-transform hover:-translate-y-0.5`}
              >
                <div className="relative z-10">
                  <p className="text-sm font-extrabold uppercase leading-tight">{t.title}</p>
                  <p className="mt-1 text-xs opacity-90">{t.subtitle}</p>
                  <ArrowRight className="mt-6 h-4 w-4" />
                </div>
                <img
                  src={t.img}
                  alt={t.title}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-24 object-contain opacity-90 mix-blend-luminosity sm:h-28 sm:w-28"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories — clean icon grid, JD style */}
      <section className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground sm:text-lg">Popular Categories</h2>
            <Link to="/categories" className="text-xs font-semibold text-primary hover:underline">
              View all →
            </Link>
          </div>
          <CategoryGrid categories={home.categories} />
        </div>
      </section>

      {/* Featured Businesses */}
      <section className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground sm:text-lg">Featured Businesses{city ? ` in ${city}` : ""}</h2>
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
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No featured listings yet. Add your business today!</p>
            <Button className="mt-4 bg-primary text-primary-foreground" asChild>
              <Link to="/business/new">Add a business</Link>
            </Button>
          </div>
        )}
        </div>
      </section>

      {/* Bottom CTA — subtle */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-background p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Own a business?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              List free on Kutchi Hub and reach local customers.
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link to="/business/new">Add Your Business</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
