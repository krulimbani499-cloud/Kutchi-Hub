// A tiny in-memory cache for PUBLIC, read-mostly server data (category counts, category list, city list ...).
// Each server instance keeps its own copy for `ttlMs`; at most one request per key is in flight at a time, and a failed
// call is never cached. Never use it for anything per-user or for admin screens.
type Entry<T> = { value: T; expires: number };

const entries = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function cachedFor<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const promise = load()
    .then((value) => {
      entries.set(key, { value, expires: Date.now() + ttlMs });
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
