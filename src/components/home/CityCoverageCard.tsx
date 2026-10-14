import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { getCityCoverage } from "@/lib/places.functions";
import { useCity, type CityCoords } from "@/hooks/useCity";

/**
 * Shown when the selected place has no published business: a friendly note and the nearest cities that do
 * have some (tap one to switch). If the place DOES have businesses (or the lookup fails) `fallback` is
 * shown instead, so the page's usual empty state is never replaced by a wrong message.
 */
export function CityCoverageCard({
  city,
  coords,
  fallback,
  onPick,
}: {
  city: string;
  coords: CityCoords | null;
  fallback: ReactNode;
  onPick?: (city: string) => void;
}) {
  const { setCity } = useCity();
  const { data, isPending } = useQuery({
    queryKey: ["city-coverage", city, coords?.lat ?? null, coords?.lng ?? null],
    queryFn: () => getCityCoverage({ data: { city, ...(coords ?? {}) } }),
    staleTime: 60_000,
  });

  if (isPending) return <div className="h-28 animate-pulse rounded-xl bg-muted" aria-hidden />;
  if (!data || data.count !== 0) return <>{fallback}</>;

  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center sm:p-8">
      <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 font-medium text-foreground">
        Abhi {city} me koi business listed nahi hai{data.nearest.length > 0 ? " — paas ke shehar:" : "."}
      </p>
      {data.nearest.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {data.nearest.map((n) => (
            <button
              key={n.city}
              type="button"
              onClick={() => (onPick ? onPick(n.city) : setCity(n.city))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {n.city}
              <span className="text-xs font-normal text-muted-foreground">
                {n.distanceKm <= 0 ? "<1" : n.distanceKm} km
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
