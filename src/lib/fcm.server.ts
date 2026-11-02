// Firebase Cloud Messaging (HTTP v1) from the server, without any extra package: sign a service-account token with node:crypto, call
// the REST API with fetch. SERVER ONLY (the file name ends in .server): the service account (FIREBASE_SERVICE_ACCOUNT_JSON, an
// environment variable of the server) never reaches the browser or the app, and is never logged. Without it everything here
// answers "not configured" and does nothing.
import { createSign } from "node:crypto";
import type { PushPlatform, PushText } from "./city-push";

export type FcmConfig = { projectId: string; clientEmail: string; privateKey: string };

type Env = Record<string, string | undefined>;
type FetchLike = typeof fetch;

/** The service account from FIREBASE_SERVICE_ACCOUNT_JSON (the JSON text, or the same JSON in base64). null = not set / not valid. */
export function readFcmConfig(env: Env = process.env): FcmConfig | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
    const privateKey = String(j.private_key ?? "").replace(/\\n/g, "\n");
    const projectId = String(j.project_id ?? "");
    const clientEmail = String(j.client_email ?? "");
    if (!projectId || !clientEmail || !privateKey.includes("BEGIN")) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://fcm.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export type FcmDeps = { fetchImpl?: FetchLike; now?: () => number; tokenUrl?: string; apiBase?: string };

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const accessTokens = new Map<string, { token: string; expiresAt: number }>();

/** An OAuth access token for FCM (cached for ~55 minutes). Throws a plain error WITHOUT any key material. */
export async function getAccessToken(cfg: FcmConfig, deps: FcmDeps = {}): Promise<string> {
  const now = (deps.now ?? Date.now)();
  const cached = accessTokens.get(cfg.clientEmail);
  if (cached && cached.expiresAt > now + 60_000) return cached.token;
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: deps.tokenUrl ?? TOKEN_URL, iat, exp: iat + 3600 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(cfg.privateKey);
  const res = await (deps.fetchImpl ?? fetch)(deps.tokenUrl ?? TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`FCM sign-in failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("FCM sign-in gave no token");
  accessTokens.set(cfg.clientEmail, { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

export function forgetAccessToken(cfg: FcmConfig) {
  accessTokens.delete(cfg.clientEmail);
}

export type FcmResult =
  | { ok: true }
  /** invalid: the token is dead (delete it) | auth: our credentials are refused | transient: try again later | other */
  | { ok: false; kind: "invalid" | "auth" | "transient" | "other"; status: number };

type FcmError = { error?: { status?: string; message?: string; details?: Array<{ errorCode?: string }> } };

export function classifyFcmError(status: number, body: FcmError | null): FcmResult {
  const err = body?.error;
  const codes = (err?.details ?? []).map((d) => d.errorCode).filter(Boolean) as string[];
  const text = `${err?.status ?? ""} ${err?.message ?? ""}`.toLowerCase();
  if (codes.includes("UNREGISTERED") || codes.includes("SENDER_ID_MISMATCH") || err?.status === "NOT_FOUND" || status === 404) return { ok: false, kind: "invalid", status };
  if (err?.status === "INVALID_ARGUMENT" && text.includes("registration token")) return { ok: false, kind: "invalid", status };
  if (status === 401 || status === 403 || err?.status === "UNAUTHENTICATED" || err?.status === "PERMISSION_DENIED") return { ok: false, kind: "auth", status };
  if (status === 429 || status >= 500 || ["UNAVAILABLE", "INTERNAL", "RESOURCE_EXHAUSTED"].includes(err?.status ?? "")) return { ok: false, kind: "transient", status };
  return { ok: false, kind: "other", status };
}

/** One message to one token. `validateOnly`: FCM only checks it (nothing is delivered): used to see that a token is real. */
export async function sendFcm(cfg: FcmConfig, message: Record<string, unknown>, opts: { validateOnly?: boolean } = {}, deps: FcmDeps = {}): Promise<FcmResult> {
  let access: string;
  try {
    access = await getAccessToken(cfg, deps);
  } catch {
    return { ok: false, kind: "auth", status: 0 };
  }
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${deps.apiBase ?? API_BASE}/v1/projects/${cfg.projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...(opts.validateOnly ? { validate_only: true } : {}), message }),
    });
    if (res.ok) return { ok: true };
    const out = classifyFcmError(res.status, (await res.json().catch(() => null)) as FcmError | null);
    if (!out.ok && out.kind === "auth") forgetAccessToken(cfg);
    return out;
  } catch {
    return { ok: false, kind: "transient", status: 0 };
  }
}

/**
 * The message for one device. Web gets DATA ONLY (the service worker shows it and opens the link, so the wording and the address
 * are ours); a phone gets a normal notification (the system shows it, also when the app is closed) with the page in `link_url`.
 */
export function buildFcmMessage(token: string, platform: PushPlatform, text: PushText, siteUrl: string): Record<string, unknown> {
  if (platform === "web") {
    return {
      token,
      data: { title: text.title, body: text.body, link_url: `${siteUrl}${text.link}`, tag: text.tag },
      webpush: { headers: { TTL: "86400", Urgency: "normal" } },
    };
  }
  return {
    token,
    notification: { title: text.title, body: text.body },
    data: { link_url: text.link, tag: text.tag },
    android: { priority: "NORMAL", ttl: "86400s", notification: { channel_id: "new_business", tag: text.tag } },
    apns: { headers: { "apns-priority": "5" }, payload: { aps: { sound: "default" } } },
  };
}

export type Target = { id: string; token: string; platform: PushPlatform };
export type SendSummary = { sent: number; failed: number; invalidIds: string[]; authFailed: boolean };

/** The same text to many devices (a few at a time). Dead tokens are reported so the caller can delete them. */
export async function sendToMany(cfg: FcmConfig, targets: readonly Target[], text: PushText, siteUrl: string, deps: FcmDeps = {}, concurrency = 20): Promise<SendSummary> {
  const out: SendSummary = { sent: 0, failed: 0, invalidIds: [], authFailed: false };
  let next = 0;
  async function worker() {
    while (!out.authFailed) {
      const t = targets[next++];
      if (!t) return;
      const r = await sendFcm(cfg, buildFcmMessage(t.token, t.platform, text, siteUrl), {}, deps);
      if (r.ok) out.sent += 1;
      else {
        out.failed += 1;
        if (r.kind === "invalid") out.invalidIds.push(t.id);
        if (r.kind === "auth") out.authFailed = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, targets.length)) }, worker));
  return out;
}
