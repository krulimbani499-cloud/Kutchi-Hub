import { useEffect, useState } from "react";
import { useDiwali } from "@/hooks/useDiwali";
import { DIWALI_DISMISS_KEY, DIWALI_FIREWORKS_KEY, readFlag, writeFlag } from "@/lib/diwali";
import { DiwaliGreeting } from "./DiwaliGreeting";

/**
 * Home page, Diwali days only: the greeting card (dismissable, remembered on the device) and, on the FIRST home visit per device,
 * a short fireworks burst. The fireworks code is a separate file loaded only when it is about to play, so it costs nothing on the
 * other days or on later visits. Nothing is drawn or loaded when the theme is off.
 */
export function DiwaliHome() {
  const { mode } = useDiwali();
  // null = not read yet (nothing drawn, so a dismissed card never flashes).
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // A preview (?diwali=1) never reads or writes the stored flags: it always shows the card and the fireworks.
    setDismissed(mode === "on" ? readFlag(DIWALI_DISMISS_KEY) : false);
  }, [mode]);

  useEffect(() => {
    if (mode === "off") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // no animation at all
    if (mode === "on" && readFlag(DIWALI_FIREWORKS_KEY)) return; // already played on this device
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import("./fireworks").then((m) => {
      if (cancelled) return;
      if (mode === "on") writeFlag(DIWALI_FIREWORKS_KEY);
      stop = m.launchFireworks();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode]);

  if (mode === "off" || dismissed !== false) return null;
  return (
    <DiwaliGreeting
      onDismiss={() => {
        setDismissed(true);
        if (mode === "on") writeFlag(DIWALI_DISMISS_KEY);
      }}
    />
  );
}
