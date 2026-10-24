import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNearbyBusinesses } from "@/lib/businesses.functions";
import { getCurrentLocation, type LocationError } from "@/lib/geolocation";
import { BusinessCard } from "@/components/business/BusinessCard";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { HorizontalCardRow } from "@/components/home/HorizontalCardRow";

export function NearbyBusinesses() {
  const sectionRef = useScrollAnimation<HTMLElement>();
  const fetchNearby = useServerFn(getNearbyBusinesses);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Location refused: the whole section is hidden (no message, nothing to nag about).
  const [denied, setDenied] = useState(false);

  const detect = async () => {
    setError(null);
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      setCoords({ lat: loc.latitude, lng: loc.longitude });
    } catch (e) {
      if ((e as LocationError).denied) setDenied(true);
      else setError(e instanceof Error ? e.message : "Could not get location.");
    } finally {
      setLocating(false);
    }
  };

  // Use the location straight away if permission was already granted; hide the section if it was refused.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    let status: PermissionStatus | null = null;
    const apply = () => {
      if (!status) return;
      if (status.state === "granted") {
        setDenied(false);
        void detect();
      } else if (status.state === "denied") setDenied(true);
    };
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        status = p;
        apply();
        p.onchange = apply;
      })
      .catch(() => {});
    return () => {
      if (status) status.onchange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["nearby-businesses", coords?.lat, coords?.lng],
    queryFn: () => fetchNearby({ data: { lat: coords!.lat, lng: coords!.lng, limit: 8 } }),
    enabled: !!coords,
    staleTime: 60_000,
  });

  if (denied) return null;

  const businesses = data?.businesses ?? [];

  return (
    <section ref={sectionRef} className="animate-on-scroll mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            Nearby Businesses
          </h2>
          {!coords && (
            <Button size="sm" variant="outline" onClick={detect} disabled={locating}>
              {locating ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <LocateFixed className="mr-2 h-3.5 w-3.5" />
              )}
              {locating ? "Locating..." : "Use my location"}
            </Button>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {!coords && !error && (
          <p className="text-sm text-muted-foreground">
            Turn on location to see businesses closest to you.
          </p>
        )}

        {coords && isLoading && (
          // Same horizontal skeleton row as the Featured section.
          <HorizontalCardRow>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" aria-label="Finding businesses near you" />
            ))}
          </HorizontalCardRow>
        )}

        {coords && data && businesses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No businesses found within {data.radiusKm} km. Try browsing categories instead.
          </p>
        )}

        {businesses.length > 0 && (
          // The same swipeable row (scroll-snap, next card peeks in, arrows on desktop) as Featured businesses.
          <HorizontalCardRow>
            {businesses.map((b) => (
              <div key={b.id} className="relative flex flex-col [&>*:first-child]:flex-1">
                <BusinessCard business={b} />
                <span className="absolute right-2 top-10 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground shadow">
                  {b.distanceKm.toFixed(1)} km
                </span>
              </div>
            ))}
          </HorizontalCardRow>
        )}
      </div>
    </section>
  );
}
