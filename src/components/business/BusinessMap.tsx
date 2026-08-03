import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusinessMapProps {
  lat: number | null;
  lng: number | null;
  name: string;
  address?: string | null;
}

export function BusinessMap({ lat, lng, name, address }: BusinessMapProps) {
  const hasCoords = lat != null && lng != null;
  const query = hasCoords ? `${lat},${lng}` : encodeURIComponent(address?.trim() || name);
  const viewUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-orange-50/60 to-card">
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff6a00]/10">
          <MapPin className="h-6 w-6 text-[#ff6a00]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          {address && <p className="mt-1 text-sm text-muted-foreground">{address}</p>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm" className="rounded-full bg-[#ff6a00] text-white hover:bg-[#e65a00]">
            <a href={viewUrl} target="_blank" rel="noreferrer">
              📍 View on Google Maps
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              <Navigation className="mr-1.5 h-3.5 w-3.5" /> Get Directions
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
