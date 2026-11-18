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
    <div role="alert" className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[#faf8f5] px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center">
      {/* Same look as native-www/offline.html (the page shown when the app starts without internet). */}
      <p className="mb-4 text-2xl font-extrabold tracking-wide text-[#111]"><span className="text-[#E8590C]">KUTCHI</span> HUB</p>
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ffe9d6] text-[#E8590C]">
        <WifiOff className="h-9 w-9" />
      </span>
      <h1 className="text-[1.35rem] font-bold text-[#1f2430]">Internet connection nahi hai</h1>
      <p className="max-w-xs text-[#5b6270]">Apna Wi-Fi ya mobile data check karke dobara try karein.</p>
      <Button className="min-h-12 rounded-full bg-[#E8590C] px-7 text-base text-white hover:bg-[#c94a06]" onClick={() => { if (navigator.onLine) setOffline(false); }}>
        Dobara try karein
      </Button>
    </div>
  );
}
