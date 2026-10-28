import { DIWALI_END, DIWALI_START } from "./features";

/** Is the Diwali theme on right now? Between DIWALI_START and DIWALI_END (features.ts), both included. */
export function isDiwaliPeriod(now: number = Date.now()): boolean {
  return now >= Date.parse(DIWALI_START) && now <= Date.parse(DIWALI_END);
}

/** Per-year flags: a new year (new dates) starts with nothing dismissed and the fireworks unplayed. */
const YEAR = new Date(DIWALI_START).getUTCFullYear();
export const DIWALI_DISMISS_KEY = `kutchi-hub:diwali-greeting-dismissed:${YEAR}`;
export const DIWALI_FIREWORKS_KEY = `kutchi-hub:diwali-fireworks-played:${YEAR}`;

// Storage can be blocked (private window, cleared site data): every read and write is wrapped, and the page works without it.
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
export function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}
