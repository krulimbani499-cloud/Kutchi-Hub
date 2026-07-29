// Parse business hours like "9:00 AM - 6:00 PM", "09:00-18:00", "9am-6pm",
// or comma-separated multi-shift "9:00 AM - 1:00 PM, 3:00 PM - 8:00 PM".
// Returns true if current time falls within any range for today.

function parseTimeToMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  // matches "9", "9:30", "9am", "9:30pm", "21:00"
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3];
  if (mer === "am") {
    if (h === 12) h = 0;
  } else if (mer === "pm") {
    if (h !== 12) h += 12;
  }
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function isOpenNow(hours: unknown, now: Date = new Date()): boolean | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const map = hours as Record<string, string>;
  const today = now.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const raw = map[today];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^closed$/i.test(trimmed)) return false;
  if (/^(24\s*hours?|24\/7|open\s*24)/i.test(trimmed)) return true;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const ranges = trimmed.split(",");
  let sawRange = false;
  for (const r of ranges) {
    const parts = r.split(/[-–—to]+/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2) continue;
    const start = parseTimeToMinutes(parts[0]);
    const end = parseTimeToMinutes(parts[1]);
    if (start == null || end == null) continue;
    sawRange = true;
    if (end > start) {
      if (nowMin >= start && nowMin < end) return true;
    } else {
      // overnight: e.g. 8 PM - 2 AM
      if (nowMin >= start || nowMin < end) return true;
    }
  }
  // If we couldn't parse any range, fall back to "not closed" = open
  if (!sawRange) return true;
  return false;
}

export function hasAnyHours(hours: unknown): boolean {
  return (
    !!hours &&
    typeof hours === "object" &&
    !Array.isArray(hours) &&
    Object.keys(hours as object).length > 0
  );
}