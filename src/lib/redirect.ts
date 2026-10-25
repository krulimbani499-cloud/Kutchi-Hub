// "Send the person to sign in, then bring them back to where they were going" (?redirect=/business/new on the /auth page).

/** Only a path inside this site is allowed (no other site, no protocol-relative //host, no /auth loop). Anything else is dropped. */
export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v.length === 0 || v.length > 500) return undefined;
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return undefined;
  if (/[\u0000-\u001f\u007f]/.test(v)) return undefined;
  if (v === "/auth" || v.startsWith("/auth?") || v.startsWith("/auth/")) return undefined;
  return v;
}

// For sign-ups that need an e-mail confirmation or a Google / Apple round trip: the page that comes back lands on "/", so the
// destination is kept here for a short while and used once, after the person is signed in.
const KEY = "kh:post-auth-redirect";
const MAX_AGE_MS = 30 * 60_000;

export function rememberRedirect(path: string | undefined) {
  try {
    if (path) localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage can be blocked: the person just lands on the home page */
  }
}

/** The remembered destination (once), or undefined if there is none or it is older than 30 minutes. */
export function takeRememberedRedirect(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > MAX_AGE_MS) return undefined;
    return safeRedirectPath(parsed.path);
  } catch {
    return undefined;
  }
}
