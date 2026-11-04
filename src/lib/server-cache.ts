// A tiny in-memory cache for PUBLIC, read-mostly server data (category counts, category list, city list, search results ...).
// Each server instance keeps its own copy for `ttlMs`; at most one request per key is in flight at a time, and a failed
// call is never cached. Never use it for anything per-user or for admin screens.
// The cache is bounded (MAX_ENTRIES): when it is full the expired entries go first, then the oldest ones, so a crawler asking for
// thousands of different searches can not grow the memory of the instance without limit.
type Entry<T> = { value: T; expires: number };

const MAX_ENTRIES = 400;
const entries = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function makeRoom(now: number): void {
  if (entries.size < MAX_ENTRIES) return;
  for (const [key, entry] of entries) if (entry.expires <= now) entries.delete(key);
  // Map keeps insertion order: the first keys are the oldest.
  for (const key of entries.keys()) {
    if (entries.size < MAX_ENTRIES) break;
    entries.delete(key);
  }
}

export async function cachedFor<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const promise = load()
    .then((value) => {
      const now = Date.now();
      entries.delete(key); // a refreshed key goes to the back of the line
      makeRoom(now);
      entries.set(key, { value, expires: now + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

/** Forget cached values whose key starts with `prefix` (for the rare write that should show up at once). */
export function clearCached(prefix = ""): void {
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
}

/** Forget every cached PUBLIC answer of this instance. Called after an admin / owner changes a business or a category. */
export function clearPublicCaches(): void {
  clearCached("search:");
  clearCached("allbiz:");
  clearCached("home:");
  clearCached("directory");
  clearCached("banners:");
  clearCached("biz:");
  clearCached("sitemap");
}
