// "New business in <your city>" alerts INSIDE THE iOS APP. CLIENT side, iOS app only.
//
// Why @capacitor-firebase/messaging and not @capacitor/push-notifications: on an iPhone the Apple plugin hands over the APNs
// token, but our server sends through Firebase Cloud Messaging (src/lib/fcm.server.ts), which needs an FCM token. The Firebase
// plugin gives exactly that token (and asks Apple's permission itself), so the iPhone is stored in the same push_subscriptions
// table as the browsers, with platform "ios", per city. Nothing here runs by itself: the permission dialog is only opened from
// enableNativePush(), which the "Naye business ki khabar" card calls when the person taps it.
//
// Every call checks that the plugin exists first (an older installed app may not contain it) and nothing here ever throws.
import { registerPlugin } from "@capacitor/core";
import { isIosApp, nativePluginAvailable } from "@/lib/native";
import { registerPushSubscription, unregisterPushSubscription } from "@/lib/push.functions";
import type { Lang } from "@/lib/i18n";

/** The plugin name Capacitor knows it by. */
const PLUGIN = "FirebaseMessaging";

// The npm package @capacitor-firebase/messaging provides the NATIVE iOS side only (it is what `npx cap sync ios` links in). The page talks
// to it through this small typed handle instead of importing the package's JavaScript: that JavaScript is the browser version and pulls in
// the whole Firebase web SDK, which this site does not need (the website has its own, see web-push.ts).
type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";
interface FirebaseMessagingNative {
  checkPermissions(): Promise<{ receive: PermissionState }>;
  requestPermissions(): Promise<{ receive: PermissionState }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  addListener(
    event: "notificationActionPerformed",
    listener: (e: { actionId?: string; notification?: { data?: unknown } }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}
const FirebaseMessaging = registerPlugin<FirebaseMessagingNative>(PLUGIN);

/** Can this page do native push? Only inside the iOS app, and only when the app build contains the Firebase push plugin. */
export function nativePushAvailable(): boolean {
  return isIosApp() && nativePluginAvailable(PLUGIN);
}

export type NativeEnableResult = { ok: true; token: string } | { ok: false; reason: "unavailable" | "denied" | "error" };

/**
 * Ask iOS for notification permission (the system dialog, shown once), get this phone's FCM token and save it for `city`.
 * Call it from a tap, never at app start.
 */
export async function enableNativePush(city: string, lang?: Lang): Promise<NativeEnableResult> {
  if (!nativePushAvailable()) return { ok: false, reason: "unavailable" };
  try {
    let perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await FirebaseMessaging.requestPermissions();
    if (perm.receive !== "granted") return { ok: false, reason: "denied" };
    const { token } = await FirebaseMessaging.getToken();
    if (!token) return { ok: false, reason: "error" };
    const answer = await registerPushSubscription({ data: { token, platform: "ios", city, lang } });
    if (!answer.ok) return { ok: false, reason: "error" };
    return { ok: true, token };
  } catch (e) {
    console.error("[native push] enable failed", (e as Error)?.message);
    return { ok: false, reason: "error" };
  }
}

/** Alerts off: the phone drops its FCM token (so Firebase stops delivering to it). The server row is removed by the caller. */
export async function disableNativePush(token: string): Promise<void> {
  try {
    await unregisterPushSubscription({ data: { token } });
  } catch {
    /* the sender removes the row once the token stops working */
  }
  if (!nativePushAvailable()) return;
  try {
    await FirebaseMessaging.deleteToken();
  } catch {
    /* ignore */
  }
}

/**
 * Tapping a notification opens the page it carries in `data.link_url` (a path like /business/some-slug). Returns the function that
 * removes the listener. Only paths on our own site are followed.
 */
export async function listenForNotificationTaps(open: (path: string) => void): Promise<() => void> {
  if (!nativePushAvailable()) return () => {};
  try {
    const handle = await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      if (event.actionId === "dismiss") return;
      const link = (event.notification?.data as { link_url?: unknown } | undefined)?.link_url;
      if (typeof link === "string" && link.startsWith("/") && !link.startsWith("//")) open(link);
    });
    return () => void handle.remove().catch(() => {});
  } catch {
    return () => {};
  }
}
