import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { BusinessPhotoImage } from "@/components/business/BusinessPhotoImage";

export function RecentlyViewed() {
  const list = useRecentlyViewed();
  if (list.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-4">
      <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
            <Clock className="h-4 w-4 text-[#ff6a00]" /> Recently Viewed
          </h2>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {list.map((b) => (
            <Link
              key={b.id}
              to="/business/$slug"
              params={{ slug: b.slug }}
              className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
            >
              <div className="h-24 w-full overflow-hidden bg-muted">
                {b.featured_image ? (
                  <BusinessPhotoImage
                    src={b.featured_image}
                    alt={b.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 text-lg font-bold text-primary">
                    {b.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="line-clamp-1 text-xs font-semibold text-foreground">{b.name}</p>
                <p className="line-clamp-1 text-[10px] text-muted-foreground">
                  {b.category ?? "Business"}
                  {b.city ? ` · ${b.city}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}