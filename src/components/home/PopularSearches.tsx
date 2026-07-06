import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useRef } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

// Manual image overrides for specific category slugs. Everything else falls
// back to a keyword-based loremflickr photo.
const IMAGE_OVERRIDES: Record<string, string> = {
  hotels:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
  restaurants:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
  hospitals:
    "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=800&q=80",
  schools:
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80",
  grocery:
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
  "grocery-stores":
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
  supermarkets:
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
  gyms:
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
  doctors:
    "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
  "beauty-parlour":
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
};

function imageFor(cat: Category) {
  return (
    IMAGE_OVERRIDES[cat.slug] ??
    `https://loremflickr.com/480/320/${encodeURIComponent(cat.name)}?lock=${cat.id.slice(0, 8)}`
  );
}

export function PopularSearches({ categories }: { categories: Category[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const items = categories
    .filter((c) => {
      const s = c.slug.toLowerCase();
      const n = c.name.toLowerCase();
      return !s.includes("salon") && !n.includes("salon") && !s.includes("saloon") && !n.includes("saloon");
    })
    .slice(0, 10);

  if (items.length === 0) return null;

  const scrollNext = () => {
    scrollerRef.current?.scrollBy({ left: 300, behavior: "smooth" });
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6">
      <h2 className="mb-4 text-lg font-extrabold text-foreground sm:text-xl">Popular Searches</h2>
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((cat) => (
            <Link
              key={cat.id}
              to="/search"
              search={{ category: cat.slug }}
              className="group relative shrink-0 snap-start overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border transition-transform hover:-translate-y-0.5"
              style={{ width: "240px" }}
            >
              <div className="relative h-40 w-full overflow-hidden bg-muted">
                <img
                  src={imageFor(cat)}
                  alt={cat.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="bg-[#1a73e8] p-3 text-white">
                <p className="line-clamp-1 text-sm font-semibold">{cat.name}</p>
                <span className="mt-2 inline-block rounded-md bg-white px-3 py-1 text-xs font-semibold text-[#1a73e8]">
                  Enquire Now
                </span>
              </div>
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Scroll popular searches"
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md ring-1 ring-border hover:bg-muted sm:block"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>
      </div>
    </section>
  );
}