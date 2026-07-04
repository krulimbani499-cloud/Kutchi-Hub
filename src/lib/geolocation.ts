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

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? Infinity,
          source: "gps",
        }),
      (err) => reject(new Error(formatBrowserLocationError(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
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