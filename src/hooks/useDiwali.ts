import { useSyncExternalStore } from "react";
import { isDiwaliPeriod } from "@/lib/diwali";

// ?diwali=1 on any address turns the theme on for PREVIEW. It lives in memory only (nothing is stored): it survives moving between
// pages of the site, and is gone on the next reload without the parameter.
const previewRequested =
  typeof window !== "undefined" &&
  (() => {
    try {
      return new URLSearchParams(window.location.search).get("diwali") === "1";
    } catch {
      return false;
    }
  })();

// Re-checked every minute, so the theme switches on / off by itself while a page is open.
const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};

type Mode = "off" | "on" | "preview";
const snapshot = (): Mode => (isDiwaliPeriod() ? "on" : previewRequested ? "preview" : "off");

/**
 * "on" = the real Diwali dates, "preview" = ?diwali=1 outside the dates, "off" = nothing. The server and the first render always
 * say "off", then React switches to the real answer: no hydration mismatch, and a visitor's clock decides (no cached page can
 * show the theme on the wrong days).
 */
export function useDiwali(): { active: boolean; mode: Mode } {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "off" as Mode);
  return { active: mode !== "off", mode };
}
