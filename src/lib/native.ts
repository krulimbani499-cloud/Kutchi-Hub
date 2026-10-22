// Helpers for the Capacitor app (iOS and Android). In a normal browser everything here says "not native" and does nothing.
// The app is a native shell around the website, so the plugins are looked up with isPluginAvailable: an older installed
// app may not contain a plugin that this web code knows about, and must keep working.
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** True only inside the iOS app (not Safari, not the Android app). */
export function isIosApp(): boolean {
  return typeof window !== "undefined" && Capacitor.getPlatform() === "ios";
}

/**
 * Is this native plugin usable right now? iOS app only, on purpose: the Android app is left exactly as it is (it has no
 * push / Firebase setup, and its installed versions do not contain these plugins).
 */
export function nativePluginAvailable(name: string): boolean {
  return isIosApp() && Capacitor.isPluginAvailable(name);
}

/** Open the iOS / Android share sheet. Returns false when the native plugin is not there (caller falls back). */
export async function nativeShare(opts: { title: string; text?: string; url: string }): Promise<boolean> {
  if (!nativePluginAvailable("Share")) return false;
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: "Share" });
    return true;
  } catch (e) {
    // The person closing the share sheet rejects with "Share canceled": that is a normal outcome, not a failure.
    if (e instanceof Error && /cancel/i.test(e.message)) return true;
    return false;
  }
}

export type NativeFix = { latitude: number; longitude: number; accuracy: number };

/**
 * One GPS fix through the native location plugin (a single, real iOS permission prompt, and the usage text from
 * Info.plist). Returns null when the plugin is not there; throws an error with `denied` when permission is refused.
 */
export async function nativeCurrentPosition(): Promise<NativeFix | null> {
  if (!nativePluginAvailable("Geolocation")) return null;
  const { Geolocation } = await import("@capacitor/geolocation");
  let perm = await Geolocation.checkPermissions();
  if (perm.location !== "granted") perm = await Geolocation.requestPermissions({ permissions: ["location"] });
  if (perm.location !== "granted") {
    const err = new Error("Location permission denied. Enable it in Settings > Kutchi Hub > Location.") as Error & { denied?: boolean };
    err.denied = true;
    throw err;
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? Infinity };
}
