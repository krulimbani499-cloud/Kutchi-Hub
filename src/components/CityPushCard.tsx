import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCity } from "@/hooks/useCity";
import { useLanguage } from "@/lib/i18n";
import { useCityPushAccess } from "@/hooks/useCityPushAccess";
import { PUSH_EVENT, disableWebPush, dismissPush, enableWebPush, pushDismissed, pushSupported, readStoredPush } from "@/lib/web-push";

/**
 * "🔔 Get alerts for new businesses": the only place that opens the browser's notification permission, and only when the person
 * taps the button. Draws nothing unless the person may see it (SHOW_CITY_PUSH on, or the flag off and the person is a signed-in ADMIN:
 * "TEST MODE"), the Firebase settings are there, the browser can do it, and a city (not "All locations") is chosen: so for everybody
 * else it changes nothing on the page, no empty gap either.
 *   not turned on : a card with the button (and "Not now": afterwards only the small button stays, for 30 days the card is gone)
 *   turned on     : one line "Alerts for new businesses in <city> are ON" with "Turn off"
 */
export function CityPushCard() {
  const { t, lang } = useLanguage();
  const { city, allLocations } = useCity();
  const { allowed, testMode } = useCityPushAccess();
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"denied" | "error" | null>(null);

  useEffect(() => {
    setReady(true); // the browser decides: the server render and the first render draw nothing
    const again = () => setTick((n) => n + 1);
    window.addEventListener(PUSH_EVENT, again);
    return () => window.removeEventListener(PUSH_EVENT, again);
  }, []);

  if (!ready || !allowed || !pushSupported() || !city || allLocations) return null;
  const stored = readStoredPush();
  const blocked = typeof Notification !== "undefined" && Notification.permission === "denied";
  if (!stored && blocked && !problem) return null; // blocked in the browser settings and no attempt just now: nothing to offer

  const turnOn = async () => {
    setBusy(true);
    setProblem(null);
    const result = await enableWebPush(city, lang);
    setBusy(false);
    if (!result.ok) setProblem(result.reason === "denied" ? "denied" : "error");
  };
  const turnOff = async () => {
    setBusy(true);
    await disableWebPush();
    setBusy(false);
  };
  const say = (key: string) => t(key).replace("{city}", stored?.city ?? city);
  const testBadge = testMode ? (
    <span data-test-mode className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      TEST MODE
    </span>
  ) : null;

  if (stored) {
    return (
      <div data-city-push="on" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <span className="flex flex-wrap items-center gap-2 text-foreground">
          {say("push.on")}
          {testBadge}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={turnOff} disabled={busy}>
          {busy ? t("push.working") : t("push.off")}
        </Button>
      </div>
    );
  }

  const compact = pushDismissed();
  return (
    <div
      data-city-push="offer"
      className={compact ? "mt-3" : "mt-3 flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"}
    >
      {/* On a phone the text and the buttons stack (side by side the text was squeezed into a thin column). */}
      {!compact && (
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-foreground sm:flex-1">
          {say("push.text")}
          {testBadge}
        </span>
      )}
      {compact && testBadge}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={turnOn} disabled={busy} className="bg-primary text-primary-foreground">
          {busy ? t("push.working") : t("push.cta")}
        </Button>
        {!compact && (
          <Button type="button" variant="ghost" size="sm" onClick={dismissPush} disabled={busy}>
            {t("push.later")}
          </Button>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-xs text-destructive sm:basis-full">
          {t(problem === "denied" ? "push.denied" : "push.error")}
        </p>
      )}
    </div>
  );
}
