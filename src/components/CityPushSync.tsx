import { useEffect } from "react";
import { useCity } from "@/hooks/useCity";
import { pushAvailable, syncPushCity } from "@/lib/web-push";

/**
 * Renders nothing. When alerts are on and the person picks another city, the subscription moves to it (the server then sends that
 * city's news to this browser). "All locations" changes nothing. Does nothing at all unless the feature is available.
 */
export function CityPushSync() {
  const { city, allLocations } = useCity();
  useEffect(() => {
    if (!city || allLocations || !pushAvailable()) return;
    void syncPushCity(city);
  }, [city, allLocations]);
  return null;
}
