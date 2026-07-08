import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/businesses.functions";
import { CategoryGrid } from "@/components/business/CategoryGrid";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2, Mic, ArrowRight, Smartphone, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import ogImage from "@/assets/kutchi-hub-og.jpg";
import { CitySelector } from "@/components/layout/CitySelector";
import { MarketingBanner } from "@/components/home/MarketingBanner";
import { CollectionsSection } from "@/components/home/CollectionsSection";
import { TravelBookingsSection } from "@/components/home/TravelBookingsSection";
import { PopularSearches } from "@/components/home/PopularSearches";
import { RecentlyViewed } from "@/components/home/RecentlyViewed";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import tileB2B from "@/assets/tile-b2b.jpg";
import tileRepairs from "@/assets/tile-repairs.jpg";
import tileRealEstate from "@/assets/tile-realestate.jpg";
import tileDoctors from "@/assets/tile-doctors.jpg";
import { useCity } from "@/hooks/useCity";
import { Reveal } from "@/components/Reveal";

const homeQueryOptions = (city?: string) =>
  queryOptions({
    queryKey: ["home", city ?? null],
    queryFn: () => getHomeData({ data: { city } }),
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
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQueryOptions()),
  component: HomePage,
});

// Update this number as the directory grows month over month.
const BUSINESS_COUNT = 500;

function AnimatedCount({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return (
    <span className="inline-block text-[#ff6a00] tabular-nums [font-variant-numeric:tabular-nums] animate-scale-in">
      {value.toLocaleString()}+
    </span>
  );
}

function HomePage() {
  const { city } = useCity();
  const { data: home } = useSuspenseQuery(homeQueryOptions(city ?? undefined));
  const [search, setSearch] = useState("");

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
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
            <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
              Search across{" "}
              <AnimatedCount target={BUSINESS_COUNT} />{" "}
              <span className="animate-text-shine font-extrabold">Kutchi Businesses</span>
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <PWAInstallButton />
              <button
              type="button"
              onClick={() =>
                alert("Download app coming soon! The application link will be added once the app is ready.")
              }
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-border bg-background py-1.5 pl-5 pr-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ff6a00]/40 hover:shadow-md"
              aria-label="Download App"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#ff6a00]/15 to-transparent animate-shimmer-slide" />
              <span className="relative text-sm font-semibold text-foreground">Download App</span>
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6a00] to-[#e65a00] text-white shadow-sm animate-phone-wiggle transition-transform group-hover:scale-110">
                <Smartphone className="h-4 w-4" strokeWidth={2.5} />
              </span>
              </button>
            </div>
          </div>

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <div className="flex h-12 w-full items-center rounded-md border border-border bg-background px-1 sm:w-48">
              <CitySelector compact className="w-full justify-start bg-transparent px-2 text-foreground hover:bg-transparent" />
            </div>
            <div className="relative flex h-12 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 transition-all duration-300 focus-within:border-[#ff6a00] focus-within:shadow-[0_0_0_4px_rgba(255,106,0,0.15)]">
              <Input
                type="search"
                placeholder="Search for restaurants, doctors, salons..."
                className="h-11 flex-1 border-0 bg-transparent text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Mic className="h-5 w-5 shrink-0 text-primary transition-transform hover:scale-110" />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-10 rounded bg-primary text-primary-foreground transition-transform hover:bg-primary/90 hover:scale-105 active:scale-95"
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

      {/* Recently viewed (localStorage) */}
      <RecentlyViewed />

      {/* Promo banner + feature tiles row */}
      <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Promo banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 animate-gradient-pan p-6 sm:p-8">
            <div className="max-w-[70%]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#ff6a00]">Featured</p>
              <h3 className="mt-1 text-lg font-extrabold text-foreground sm:text-2xl">
                List Your Business
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get discovered by thousands of Kutchi customers every day.
              </p>
              <Button size="sm" className="mt-4 rounded-full bg-[#ff6a00] text-white hover:bg-[#e65a00]" asChild>
                <Link to="/list-your-business">
                  Get Started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Building2 className="absolute -right-4 -bottom-4 h-40 w-40 text-orange-200 animate-float-y" />
          </div>

          {/* Feature tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featureTiles.map((t, i) => (
              <Reveal key={t.title} delay={i * 80} y={12}>
                <Link
                key={t.title}
                to="/categories"
                className={`group relative block overflow-hidden rounded-2xl bg-gradient-to-br ${t.bg} p-4 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="relative z-10">
                  <p className="text-sm font-extrabold uppercase leading-tight">{t.title}</p>
                  <p className="mt-1 text-xs opacity-90">{t.subtitle}</p>
                  <ArrowRight className="mt-6 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
                <img
                  src={t.img}
                  alt={t.title}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-24 object-contain opacity-90 mix-blend-luminosity transition-transform duration-500 group-hover:scale-110 sm:h-28 sm:w-28"
                />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Categories — clean icon grid, JD style */}
      <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground sm:text-lg">Popular Categories</h2>
            <Link to="/categories" className="text-xs font-semibold text-primary hover:underline">
              View all →
            </Link>
          </div>
          <CategoryGrid categories={home.categories} />
        </div>
      </Reveal>

      {/* Featured Businesses */}
      <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground sm:text-lg">Featured Businesses{city ? ` in ${city}` : ""}</h2>
          <Link to="/search" className="text-sm font-medium text-primary hover:underline">
            Browse all
          </Link>
        </div>
        {home.featured.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {home.featured.map((business, i) => (
              <Reveal key={business.id} delay={i * 70} y={12}>
                <BusinessCard business={business} />
              </Reveal>
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
      </Reveal>

      {/* Top Offers */}
      {home.topOffers && home.topOffers.length > 0 && (
        <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
          <div className="rounded-2xl border-2 border-[#ff6a00]/20 bg-gradient-to-br from-[#fff4ea] to-background p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff6a00] text-white animate-pulse-glow">
                  <Tag className="h-4 w-4" />
                </span>
                Top Offers{city ? ` in ${city}` : ""}
              </h2>
              <a
                href={`/search?sort=discount${city ? `&city=${encodeURIComponent(city)}` : ""}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all →
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {home.topOffers.map((business, i) => (
                <Reveal key={business.id} delay={i * 70} y={12}>
                  <BusinessCard business={business} />
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Curated collections */}
      <Reveal><CollectionsSection /></Reveal>

      {/* Popular Searches — auto-populated from categories */}
      <Reveal><PopularSearches categories={home.categories} /></Reveal>

      {/* Travel bookings */}
      <Reveal><TravelBookingsSection /></Reveal>

      {/* Bottom CTA — subtle */}
      <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-background p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Own a business?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              List free on Kutchi Hub and reach local customers.
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground animate-pulse-glow transition-transform hover:bg-primary/90 hover:scale-105" asChild>
            <Link to="/business/new">Add Your Business</Link>
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
