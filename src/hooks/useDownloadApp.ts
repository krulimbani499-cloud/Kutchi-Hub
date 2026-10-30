import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * Where is this page open, for the "Download App" button:
 *   "hide"    inside our Android / iOS app (already installed; Apple forbids Play links), or on an iPhone / iPad (the Play link is useless);
 *   "android" the website in an Android browser (the link goes straight to the Play Store app);
 *   "show"    any other browser (desktop: the link opens in a new tab).
 * The server and the first hydration render say "show", then React switches to the real answer, so there is no hydration mismatch.
 */
export type DownloadAppMode = "show" | "android" | "hide";

export function downloadAppMode(): DownloadAppMode {
  if (typeof window === "undefined") return "show";
  const ua = navigator.userAgent.toLowerCase();
  // Our app: Capacitor, plus the older shells that only tell on the user agent (an Android web view says "; wv").
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (isNativeApp() || cap?.isNativePlatform?.() === true || ua.includes("capacitor") || (ua.includes("android") && ua.includes("; wv"))) return "hide";
  // iPhone / iPad / iPod; an iPad that asks for the desktop site says "Macintosh" but has a touch screen.
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "hide";
  return ua.includes("android") ? "android" : "show";
}

const subscribe = () => () => {};

export function useDownloadAppMode(): DownloadAppMode {
  return useSyncExternalStore(subscribe, downloadAppMode, () => "show");
}
