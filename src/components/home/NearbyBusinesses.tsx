import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNearbyBusinesses } from "@/lib/businesses.functions";
import { getCurrentLocation } from "@/lib/geolocation";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Reveal } from "@/components/Reveal";

export function NearbyBusinesses() {
  const fetchNearby = useServerFn(getNearbyBusinesses);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = async () => {
    setError(null);
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      setCoords({ lat: loc.latitude, lng: loc.longitude });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get location.");
    } finally {
      setLocating(false);
    }
  };

  // Auto-detect once if permission already granted.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") void detect();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["nearby-businesses", coords?.lat, coords?.lng],
    queryFn: () =>
      fetchNearby({ data: { lat: coords!.lat, lng: coords!.lng, radiusKm: 25, limit: 8 } }),
    enabled: !!coords,
    staleTime: 60_000,
  });

  return (
    <Reveal as="section" className="mx-auto w-full max-w-7xl px-4 py-6">
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding businesses near you…
          </div>
        )}

        {coords && data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No businesses found within 25 km. Try browsing categories instead.
          </p>
        )}

        {data && data.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((b, i) => (
              <Reveal key={b.id} delay={i * 60} y={12}>
                <div className="relative">
                  <BusinessCard business={b} />
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground shadow">
                    {b.distanceKm < 1
                      ? `${Math.round(b.distanceKm * 1000)} m`
                      : `${b.distanceKm.toFixed(1)} km`}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}