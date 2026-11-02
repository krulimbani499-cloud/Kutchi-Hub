import { SHOW_CITY_PUSH } from "@/lib/features";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Who may see the city-alerts card.
 *   flag on (SHOW_CITY_PUSH)            everybody
 *   flag off, signed in as an ADMIN     the admin only, marked TEST MODE (to try it live before it is opened to everyone)
 *   flag off, anyone else               nobody
 * The server render and the first render say "nobody" (the admin answer comes after sign-in is known), so there is no flash for
 * visitors. Whether the browser can do it at all (Firebase settings, not in an app, not an iPhone) is checked separately.
 */
export function useCityPushAccess(): { allowed: boolean; testMode: boolean } {
  const isAdmin = useIsAdmin(!SHOW_CITY_PUSH); // no admin lookup at all once the feature is open to everyone
  return { allowed: SHOW_CITY_PUSH || isAdmin, testMode: !SHOW_CITY_PUSH && isAdmin };
}
