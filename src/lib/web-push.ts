// Browser push for "New business in <your city>" (Firebase Cloud Messaging web). CLIENT side.
//
// Nothing here runs by itself. The permission dialog is only opened from enableWebPush(), which the notification button calls when
// the person taps it. The public Firebase settings come from VITE_FIREBASE_* variables (they are public by design: no secret
// in this file; the server key stays on the server). Without them, or with the feature flag off, pushAvailable() is false and the
// whole thing stays invisible. The Firebase scripts are loaded from Google's CDN only when a person turns the alerts on.
import { downloadAppMode } from "@/hooks/useDownloadApp";
import { cityKeyFor } from "@/lib/city-push";
import { registerPushSubscription, setPushCity, unregisterPushSubscription } from "@/lib/push.functions";
import type { Lang } from "@/lib/i18n";

const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
const STORE_KEY = "kh:push";
const DISMISS_KEY = "kh:push:dismissed";
const DISMISS_DAYS = 30;
export const PUSH_EVENT = "kh:push-changed";

export type FirebaseWebConfig = { apiKey: string; projectId: string; messagingSenderId: string; appId: string; vapidKey: string };

/** The public Firebase settings, or null when they are not (all) set. */
export function firebaseWebConfig(): FirebaseWebConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const cfg = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() ?? "",
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
    appId: env.VITE_FIREBASE_APP_ID?.trim() ?? "",
    vapidKey: env.VITE_FIREBASE_VAPID_KEY?.trim() ?? "",
  };
  return Object.values(cfg).every(Boolean) ? cfg : null;
}

/** Can THIS browser take part? Not inside our Android / iOS app (old builds have no push set-up), not on an iPhone / iPad. */
export function browserCanPush(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (downloadAppMode() === "hide") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Can this page do it technically: the Firebase settings are present and the browser can do it. (Who may SEE it is decided by useCityPushAccess.) */
export function pushSupported(): boolean {
  return firebaseWebConfig() !== null && browserCanPush();
}

export type StoredPush = { token: string; cityKey: string; city: string };

export function readStoredPush(): StoredPush | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Partial<StoredPush> | null;
    return raw && typeof raw.token === "string" && typeof raw.cityKey === "string" && typeof raw.city === "string" ? (raw as StoredPush) : null;
  } catch {
    return null;
  }
}

function writeStoredPush(value: StoredPush | null) {
  try {
    if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the subscription still works, the page just forgets it */
  }
  window.dispatchEvent(new Event(PUSH_EVENT));
}

/** "Not now" is remembered for 30 days. */
export function pushDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function dismissPush() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PUSH_EVENT));
}

// ---- Firebase (compat build from Google's CDN, loaded only now)

type FcmPayload = { data?: Record<string, string> };
type FirebaseMessaging = {
  getToken(o: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string>;
  deleteToken(): Promise<boolean>;
  onMessage(cb: (payload: FcmPayload) => void): () => void;
};
type FirebaseGlobal = { apps: unknown[]; initializeApp(c: Record<string, string>): unknown; messaging(): FirebaseMessaging };
const firebaseGlobal = () => (window as unknown as { firebase?: FirebaseGlobal }).firebase;

const loading = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const known = loading.get(src);
  if (known) return known;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loading.delete(src);
      reject(new Error("firebase script"));
    };
    document.head.appendChild(el);
  });
  loading.set(src, p);
  return p;
}

async function messagingFor(cfg: FirebaseWebConfig): Promise<{ messaging: FirebaseMessaging; registration: ServiceWorkerRegistration }> {
  const query = new URLSearchParams({ apiKey: cfg.apiKey, projectId: cfg.projectId, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`, { scope: "/" });
  await navigator.serviceWorker.ready;
  await loadScript(`${SDK}firebase-app-compat.js`);
  await loadScript(`${SDK}firebase-messaging-compat.js`);
  const fb = firebaseGlobal();
  if (!fb) throw new Error("firebase missing");
  if (fb.apps.length === 0) fb.initializeApp({ apiKey: cfg.apiKey, projectId: cfg.projectId, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
  return { messaging: fb.messaging(), registration };
}

export type EnableResult = { ok: true } | { ok: false; reason: "unavailable" | "denied" | "error" };

/**
 * Turn the alerts on for `city`. Call it from a tap: it asks for the browser's permission (once), registers the service worker,
 * gets this browser's FCM token and hands it to the server. Never throws.
 */
export async function enableWebPush(city: string, lang?: Lang): Promise<EnableResult> {
  const cfg = firebaseWebConfig();
  if (!pushSupported() || !cfg) return { ok: false, reason: "unavailable" };
  try {
    if (Notification.permission === "denied") return { ok: false, reason: "denied" };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const { messaging, registration } = await messagingFor(cfg);
    const token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, reason: "error" };
    const answer = await registerPushSubscription({ data: { token, platform: "web", city, lang } });
    if (!answer.ok) return { ok: false, reason: "error" };
    writeStoredPush({ token, cityKey: cityKeyFor(city), city });
    void attachForegroundMessages();
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

let foregroundOn = false;

/**
 * While a tab of the site is open and in front, Firebase hands a message to the PAGE instead of the service worker (so nothing would
 * show). This shows it as a normal notification in that case too. Called when alerts are on; does nothing without permission.
 */
export async function attachForegroundMessages(): Promise<void> {
  if (foregroundOn) return;
  const cfg = firebaseWebConfig();
  if (!cfg || !browserCanPush() || Notification.permission !== "granted") return;
  try {
    const { messaging, registration } = await messagingFor(cfg);
    foregroundOn = true;
    messaging.onMessage((payload) => {
      const d = payload?.data ?? {};
      if (!d.title) return;
      void registration.showNotification(d.title, { body: d.body ?? "", icon: "/favicon.png", badge: "/favicon.png", tag: d.tag || undefined, data: { url: d.link_url || "/" } });
    });
  } catch {
    /* the notification still comes when the tab is in the background */
  }
}

/** Alerts off: the server forgets this browser, and the browser drops its token. */
export async function disableWebPush(): Promise<void> {
  const stored = readStoredPush();
  writeStoredPush(null);
  if (!stored) return;
  try {
    await unregisterPushSubscription({ data: { token: stored.token } });
  } catch {
    /* the row is removed by the sender when the token stops working */
  }
  try {
    // The browser's own token is deleted too, so it stops receiving anything. (After a page reload the Firebase scripts are not
    // loaded any more: load them for this one call.)
    const cfg = firebaseWebConfig();
    if (cfg) await (await messagingFor(cfg)).messaging.deleteToken();
  } catch {
    /* ignore */
  }
}

/** The person picked another city: the subscription follows. Does nothing when alerts are off or the city is the same. */
export async function syncPushCity(city: string): Promise<void> {
  const stored = readStoredPush();
  if (!stored) return;
  const key = cityKeyFor(city);
  if (!key || key === stored.cityKey) return;
  try {
    const answer = await setPushCity({ data: { token: stored.token, city } });
    if (answer.ok) writeStoredPush({ ...stored, cityKey: key, city });
    else if (answer.reason === "unknown_token") writeStoredPush(null); // the server lost it: start again with the button
  } catch {
    /* try again at the next city change */
  }
}
