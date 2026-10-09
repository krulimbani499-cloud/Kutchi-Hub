import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";

// Anything Radix (dialog, sheet, popover, menu, select) or the photo lightbox renders while open.
const OPEN_LAYER =
  ':is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]):not([data-state="closed"])';
const EXIT_WINDOW_MS = 2000;

/**
 * Android hardware Back button. Does nothing in a normal browser: the listener is only
 * registered inside the Capacitor app, and @capacitor/app is only loaded there.
 */
export function NativeBackButton() {
  const router = useRouter();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    // isPluginAvailable keeps an older APK (without the native plugin) working with this code.
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("App")) return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let lastBack = 0;

    void import("@capacitor/app")
      .then(async ({ App }) => {
        const h = await App.addListener("backButton", ({ canGoBack }) => {
          // 1. An open dialog/popover/sheet/menu/lightbox closes first (Escape closes the top one).
          if (document.querySelector(OPEN_LAYER)) {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            return;
          }
          // 2. Normal back navigation.
          if (canGoBack) {
            window.history.back();
            return;
          }
          // 3. No history on an inner page (e.g. opened from a link): go home.
          if (router.state.location.pathname !== "/") {
            void router.navigate({ to: "/" });
            return;
          }
          // 4. Home: exit only on a second press within 2 seconds.
          const now = Date.now();
          if (now - lastBack < EXIT_WINDOW_MS) {
            void App.exitApp();
            return;
          }
          lastBack = now;
          setHint(true);
          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => setHint(false), EXIT_WINDOW_MS);
        });
        if (cancelled) void h.remove();
        else handle = h;
      })
      .catch(() => {
        /* plugin unavailable — leave default behaviour */
      });

    return () => {
      cancelled = true;
      clearTimeout(hideTimer);
      void handle?.remove();
    };
  }, [router]);

  if (!hint) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-[10000] flex justify-center px-4">
      <span className="rounded-full bg-foreground/90 px-4 py-2 text-sm text-background shadow-lg">
        Press back again to exit
      </span>
    </div>
  );
}
