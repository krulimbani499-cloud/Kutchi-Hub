import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminSendTestPush } from "@/lib/push.functions";
import { PUSH_EVENT, readStoredPush, type StoredPush } from "@/lib/web-push";

const MESSAGES: Record<string, string> = {
  not_configured: "Firebase is not set up on the server (the Firebase service-account setting is missing on Vercel).",
  unknown_token: "The server does not know this device. Turn the alerts off and on again on the home page, then try again.",
  dead_token: "This device's token is no longer valid, so it was removed. Turn the alerts on again on the home page, then try again.",
  refused: "Firebase refused the server key. Check the Firebase service-account setting on Vercel.",
  busy: "Firebase is busy right now. Try again in a minute.",
  rate_limited: "Too many tests. Wait a minute.",
  failed: "The test notification could not be sent.",
};

/**
 * ADMIN: "Send test notification to my device". Sends "Kutchi Hub test" at once to the browser this page is open in (the one that
 * turned the alerts on from the home page), so there is no 10-minute wait. It is not a business announcement and does not count in
 * any city's daily limit. The server checks that the caller is an admin.
 */
export function PushTestCard() {
  const sendTest = useServerFn(adminSendTestPush);
  const [device, setDevice] = useState<StoredPush | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const read = () => setDevice(readStoredPush());
    read();
    window.addEventListener(PUSH_EVENT, read);
    return () => window.removeEventListener(PUSH_EVENT, read);
  }, []);

  const send = async () => {
    if (!device) return;
    setBusy(true);
    setResult(null);
    try {
      const out = await sendTest({ data: { token: device.token } });
      setResult(out.ok ? { ok: true, text: "Test notification sent. It should appear on this device in a few seconds." } : { ok: false, text: MESSAGES[out.reason] ?? MESSAGES.failed });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error && e.message ? e.message : MESSAGES.failed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-push-test>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" /> City notifications: test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Sends &ldquo;Kutchi Hub test&rdquo; to the browser you are using right now, at once (no 10-minute wait). It does not count in any city&rsquo;s daily limit.
        </p>
        {device ? (
          <p data-push-device className="text-foreground">
            This device follows <span className="font-semibold">{device.city}</span>.
          </p>
        ) : (
          <p data-push-nodevice className="text-foreground">
            This device has no alerts yet. Open the <Link to="/" className="text-primary underline">home page</Link>, pick a city and press &ldquo;Get alerts for new businesses&rdquo; (it shows TEST MODE for admins), then come back here.
          </p>
        )}
        <Button type="button" onClick={send} disabled={!device || busy}>
          {busy ? "Sending..." : "Send test notification to my device"}
        </Button>
        {result && (
          <p role="status" data-push-result={result.ok ? "ok" : "error"} className={result.ok ? "text-emerald-700" : "text-destructive"}>
            {result.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
