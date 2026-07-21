// Browser geolocation + reverse geocoding via OpenStreetMap Nominatim.
// Client-only: never call from a loader or server function.

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: "gps" | "ip";
  warning?: string;
}

export interface ReverseGeocodeResult {
  display_name: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function formatBrowserLocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Enable it in browser settings.";
    case error.POSITION_UNAVAILABLE:
      return "GPS unavailable. Turn on location services and try again.";
    case error.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "Could not determine your location.";
  }
}

export async function getCurrentLocation(): Promise<GeolocationResult> {
  if (typeof window === "undefined") throw new Error("Location is browser only.");
  if (!navigator.geolocation) throw new Error("Geolocation is not supported by this browser.");

  // Watch for a short window and keep the most accurate fix. The first
  // fix from a phone/laptop is often a coarse cell/wifi estimate (500m+);
  // GPS refines it within a few seconds. We resolve early once we see a
  // good enough reading (<= 30m) or when the window ends.
  return new Promise((resolve, reject) => {
    let best: GeolocationPosition | null = null;
    let done = false;
    const GOOD_ENOUGH_M = 30;
    const MAX_WAIT_MS = 12000;

    const finish = (err?: GeolocationPositionError) => {
      if (done) return;
      done = true;
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* noop */
      }
      clearTimeout(timer);
      if (best) {
        resolve({
          latitude: best.coords.latitude,
          longitude: best.coords.longitude,
          accuracy: best.coords.accuracy ?? Infinity,
          source: "gps",
        });
      } else if (err) {
        reject(new Error(formatBrowserLocationError(err)));
      } else {
        reject(new Error("Could not determine your location."));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || (pos.coords.accuracy ?? Infinity) < (best.coords.accuracy ?? Infinity)) {
          best = pos;
        }
        if (best && (best.coords.accuracy ?? Infinity) <= GOOD_ENOUGH_M) {
          finish();
        }
      },
      (err) => {
        // If we already have any fix, keep it; otherwise surface the error.
        if (best) finish();
        else finish(err);
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 },
    );

    const timer = setTimeout(() => finish(), MAX_WAIT_MS);
  });
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
    { headers: { "Accept-Language": "en" } },
  );
  if (!res.ok) throw new Error("Reverse geocoding lookup failed.");
  return res.json();
}

export function extractCity(rg: ReverseGeocodeResult): string | null {
  return (
    rg.address.city ||
    rg.address.town ||
    rg.address.village ||
    rg.address.suburb ||
    null
  );
}