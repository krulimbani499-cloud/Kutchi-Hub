import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { getCurrentLocation, reverseGeocode, extractCity } from "@/lib/geolocation";

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  onAddressResolved?: (parts: {
    address: string;
    city: string | null;
    state?: string;
    pincode?: string;
  }) => void;
}

export function LocationPicker({ lat, lng, onChange, onAddressResolved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);

  const resolveAddress = async (la: number, ln: number) => {
    if (!onAddressResolved) return;
    setResolving(true);
    try {
      const rg = await reverseGeocode(la, ln);
      const road = rg.address.road ?? "";
      const suburb = rg.address.suburb ?? "";
      const composed = [road, suburb].filter(Boolean).join(", ") || rg.display_name;
      onAddressResolved({
        address: composed,
        city: extractCity(rg),
        state: rg.address.state,
        pincode: rg.address.postcode,
      });
    } catch {
      // silent — pin coords still saved
    } finally {
      setResolving(false);
    }
  };

  const useMyLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      onChange(loc.latitude, loc.longitude);
      void resolveAddress(loc.latitude, loc.longitude);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Crosshair className="mr-2 h-3.5 w-3.5" />}
          Use my current location
        </Button>
        <span className="text-xs text-muted-foreground">
          {resolving ? "Fetching address…" : "Or type your address, city and pincode above — we'll locate it automatically."}
        </span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {lat != null && lng != null ? (
        <div className="flex items-center gap-2 rounded-md border border-[#ff6a00]/30 bg-orange-50/60 px-3 py-2 text-sm text-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-[#ff6a00]" />
          <span className="font-medium">Location set ✓</span>
          <span className="text-xs text-muted-foreground">
            ({lat.toFixed(5)}, {lng.toFixed(5)})
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
          Set a location using your address above or the button above to pin it.
        </div>
      )}
    </div>
  );
}
