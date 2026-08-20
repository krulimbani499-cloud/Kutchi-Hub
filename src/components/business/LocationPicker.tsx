import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Button } from "@/components/ui/button";
import { Crosshair, Loader2 } from "lucide-react";
import { getCurrentLocation, reverseGeocode, extractCity } from "@/lib/geolocation";

// Vite doesn't preserve Leaflet's relative default-icon URLs — point them
// at the bundled asset URLs explicitly.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER: [number, number] = [23.0225, 72.5714]; // Ahmedabad, Gujarat
const DEFAULT_ZOOM = 7;
const PIN_ZOOM = 16;

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

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), PIN_ZOOM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
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

  const placePin = (la: number, ln: number) => {
    onChange(la, ln);
    void resolveAddress(la, ln);
  };

  const useMyLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      placePin(loc.latitude, loc.longitude);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  const hasPin = lat != null && lng != null;
  const position: [number, number] = hasPin ? [lat!, lng!] : DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Crosshair className="mr-2 h-3.5 w-3.5" />}
          Use my current location
        </Button>
        <span className="text-xs text-muted-foreground">
          {resolving ? "Fetching address…" : "Drag the pin or tap the map to fine-tune. Address auto-fills."}
        </span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="h-56 w-full overflow-hidden rounded-md border border-border">
        <MapContainer center={position} zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={position}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                placePin(p.lat, p.lng);
              },
            }}
          />
          <ClickToPlace onPlace={placePin} />
          {hasPin && <RecenterOnChange lat={lat!} lng={lng!} />}
        </MapContainer>
      </div>
      {hasPin && (
        <p className="text-xs text-muted-foreground">Pinned at {lat!.toFixed(5)}, {lng!.toFixed(5)}</p>
      )}
    </div>
  );
}
