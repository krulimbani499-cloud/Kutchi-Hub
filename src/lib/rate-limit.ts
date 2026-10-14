/**
 * Simple sliding-window limiter kept in memory (per server instance, so it is a guard against runaway
 * clients and quota abuse, not an exact global counter).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;
  private maxKeys: number;
  constructor(limit: number, windowMs = 60_000, maxKeys = 5000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  /** Counts one request for `key`. Returns false when the key is over its limit (the request is not counted). */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times[times.length - 1] <= now - this.windowMs) this.hits.delete(key);
    }
    // Still too many live keys: drop the oldest ones.
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
  }
}
