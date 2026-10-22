import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIosApp, nativePluginAvailable } from "@/lib/native";

/**
 * Inside the iOS app only: a full-screen "No internet connection" page while the phone is offline (the site is
 * already open and the connection drops). When the app is started with no connection at all, the native shell shows
 * native-www/offline.html instead (capacitor.config.ts: server.errorPath).
 */
export function OfflineScreen() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isIosApp()) return;
    let removeListener: (() => Promise<void>) | null = null;
    let cancelled = false;
    const update = (online: boolean) => setOffline(!online);
    const onOnline = () => update(true);
    const onOffline = () => update(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    update(navigator.onLine);

    if (nativePluginAvailable("Network")) {
      void import("@capacitor/network").then(async ({ Network }) => {
        const status = await Network.getStatus();
        if (!cancelled) update(status.connected);
        const handle = await Network.addListener("networkStatusChange", (s) => update(s.connected));
        if (cancelled) void handle.remove();
        else removeListener = () => handle.remove();
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (removeListener) void removeListener();
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="alert" className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-[#ff6a00]">
        <WifiOff className="h-8 w-8" />
      </span>
      <h1 className="text-xl font-bold text-foreground">No internet connection</h1>
      <p className="max-w-xs text-sm text-muted-foreground">Kutchi Hub needs the internet to show local businesses. Check your Wi-Fi or mobile data, then try again.</p>
      <Button className="bg-[#ff6a00] text-white hover:bg-[#e65a00]" onClick={() => { if (navigator.onLine) setOffline(false); }}>
        Try again
      </Button>
    </div>
  );
}
