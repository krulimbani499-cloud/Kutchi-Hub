import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { isIosApp, nativePluginAvailable } from "@/lib/native";
import { registerDeviceToken } from "@/lib/devices.functions";

/**
 * Native push notifications (iOS app only; renders nothing). After sign-in it asks for notification permission
 * (the system dialog, once), registers with Apple / Google and saves the phone's token for the signed-in person.
 * Tapping a notification opens the page it carries in `data.link_url`.
 * Sending the notifications themselves is a server job (see docs/ios-app.md); this part only makes the phone reachable.
 */
export function NativePush() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? null;

  useEffect(() => {
    // iOS app only. The Android app has no google-services.json, so a push call there (register / requestPermissions) would crash it:
    // the explicit platform check comes first, so on Android (and on the website) the plugin is not even loaded.
    if (!userId || !isIosApp() || !nativePluginAvailable("PushNotifications")) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        handles.push(
          await PushNotifications.addListener("registration", (token) => {
            void registerDeviceToken({ data: { token: token.value, platform: "ios" } }).catch(() => {});
          }),
          await PushNotifications.addListener("registrationError", (err) => {
            console.error("[push] registration failed", err);
          }),
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const link = (action.notification.data as { link_url?: unknown } | undefined)?.link_url;
            if (typeof link === "string" && link.startsWith("/")) void router.navigate({ to: link });
          }),
        );
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
        if (!cancelled && perm.receive === "granted") await PushNotifications.register();
      } catch (e) {
        console.error("[push] setup failed", e);
      }
    })();

    return () => {
      cancelled = true;
      for (const h of handles) void h.remove().catch(() => {});
    };
  }, [userId, router]);

  return null;
}
