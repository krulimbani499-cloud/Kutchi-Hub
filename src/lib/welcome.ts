// Remembers when the user pressed "Skip" on the Android app's welcome screen.
export const WELCOME_SKIP_KEY = "kh:welcome-skipped-at";
export const WELCOME_SKIP_DAYS = 7;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** True when Skip was pressed within the last 7 days. Anything unreadable counts as "not skipped". */
export function isWelcomeSkipped(now: number = Date.now(), storage: StorageLike | null = defaultStorage()): boolean {
  try {
    const raw = storage?.getItem(WELCOME_SKIP_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0 || at > now) return false;
    return now - at < WELCOME_SKIP_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function markWelcomeSkipped(now: number = Date.now(), storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(WELCOME_SKIP_KEY, String(now));
  } catch {
    /* ignore — the screen may show again next launch */
  }
}
