/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

declare global {
  interface Window {
    google?: typeof google;
    __nearmeMapInit?: () => void;
  }
}

const SCRIPT_ID = "google-maps-js";
let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string, channel: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    window.__nearmeMapInit = () => resolve();
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=__nearmeMapInit${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

interface BusinessMapProps {
  lat: number | null;
  lng: number | null;
  name: string;
  address?: string | null;
}

export function BusinessMap({ lat, lng, name, address }: BusinessMapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ?? "";

  useEffect(() => {
    if (!ref.current || lat == null || lng == null || !apiKey) return;
    let cancelled = false;

    loadGoogleMaps(apiKey, channel)
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const position = { lat, lng };
        const map = new window.google.maps.Map(ref.current, {
          center: position,
          zoom: 15,
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
        });
        new window.google.maps.Marker({ position, map, title: name });
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, apiKey, channel]);

  if (lat == null || lng == null) {
    return (
      <div className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
        <MapPin className="mx-auto mb-1 h-5 w-5" />
        Location not set. Use the address above for directions.
      </div>
    );
  }

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div ref={ref} className="h-56 w-full bg-muted" aria-label={`Map showing ${name}`} />
      {error && (
        <div className="border-t border-border bg-muted p-2 text-center text-xs text-destructive">{error}</div>
      )}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="block bg-card px-3 py-2 text-center text-xs font-medium text-primary hover:bg-accent"
      >
        Get directions{address ? ` — ${address}` : ""}
      </a>
    </div>
  );
}