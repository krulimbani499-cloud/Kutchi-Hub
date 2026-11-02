import { useEffect } from "react";
import { useCity } from "@/hooks/useCity";
import { useCityPushAccess } from "@/hooks/useCityPushAccess";
import { attachForegroundMessages, pushSupported, readStoredPush, syncPushCity } from "@/lib/web-push";

/**
 * Renders nothing. When alerts are on and the person picks another city, the subscription moves to it (the server then sends that
 * city's news to this browser). "All locations" changes nothing. Also lets an open tab show an alert that arrives while it is in front.
 * Does nothing at all unless the person may use the feature (see useCityPushAccess) and the browser can do it.
 */
export function CityPushSync() {
  const { city, allLocations } = useCity();
  const { allowed } = useCityPushAccess();
  useEffect(() => {
    if (!allowed || !pushSupported()) return;
    if (readStoredPush()) void attachForegroundMessages();
  }, [allowed]);
  useEffect(() => {
    if (!city || allLocations || !allowed || !pushSupported()) return;
    void syncPushCity(city);
  }, [city, allLocations, allowed]);
  return null;
}
