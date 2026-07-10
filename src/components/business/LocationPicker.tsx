/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, Loader2 } from "lucide-react";
import { getCurrentLocation } from "@/lib/geolocation";

declare global {
  interface Window {
    google?: typeof google;
    __nearmeMapInit?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;
function loadGoogleMaps(apiKey: string, channel: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    window.__nearmeMapInit = () => resolve();
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=__nearmeMapInit${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

export function LocationPicker({ lat, lng, onChange }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ?? "";

  useEffect(() => {
    if (!ref.current || !apiKey || lat == null || lng == null) return;
    let cancelled = false;

    loadGoogleMaps(apiKey, channel)
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const pos = { lat: lat!, lng: lng! };
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(ref.current, {
            center: pos,
            zoom: 16,
            streetViewControl: false,
            mapTypeControl: false,
          });
          markerRef.current = new window.google.maps.Marker({
            position: pos,
            map: mapRef.current,
            draggable: true,
          });
          markerRef.current.addListener("dragend", () => {
            const p = markerRef.current!.getPosition();
            if (p) onChange(p.lat(), p.lng());
          });
          mapRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            markerRef.current!.setPosition(e.latLng);
            onChange(e.latLng.lat(), e.latLng.lng());
          });
        } else {
          mapRef.current.setCenter(pos);
          markerRef.current?.setPosition(pos);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [lat, lng, apiKey, channel, onChange]);

  const useMyLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      onChange(loc.latitude, loc.longitude);
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
        <span className="text-xs text-muted-foreground">Tip: drag the pin or tap on the map to fine-tune.</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {lat != null && lng != null && apiKey ? (
        <div ref={ref} className="h-56 w-full overflow-hidden rounded-md border border-border bg-muted" />
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
          Set a location using your address or the button above to pin it on the map.
        </div>
      )}
    </div>
  );
}
