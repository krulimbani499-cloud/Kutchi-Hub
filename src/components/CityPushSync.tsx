import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useCity } from "@/hooks/useCity";
import { useCityPushAccess } from "@/hooks/useCityPushAccess";
import { listenForNotificationTaps, nativePushAvailable } from "@/lib/native-push";
import { attachForegroundMessages, pushSupported, readStoredPush, syncPushCity } from "@/lib/web-push";

/**
 * Renders nothing. When alerts are on and the person picks another city, the subscription moves to it (the server then sends that
 * city's news to this browser). "All locations" changes nothing. Also lets an open tab show an alert that arrives while it is in front.
 * Does nothing at all unless the person may use the feature (see useCityPushAccess) and the browser can do it.
 */
export function CityPushSync() {
  const { city, allLocations } = useCity();
  const { allowed } = useCityPushAccess();
  const router = useRouter();
  // iOS app: tapping a notification opens its page (link_url). Listening asks for nothing; notifications only exist once the person turned alerts on.
  useEffect(() => {
    if (!nativePushAvailable()) return;
    let off: () => void = () => {};
    let cancelled = false;
    void listenForNotificationTaps((path) => router.history.push(path) /* path + query, e.g. /all-business?city=x&sort=newest */).then((remove) => {
      if (cancelled) remove();
      else off = remove;
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [router]);
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
