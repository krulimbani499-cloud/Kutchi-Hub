// Owners can only edit a published business while it has an active plan. The database enforces this
// (see supabase/pending/edit-requires-plan); these helpers turn its rejections into one friendly message.

export const EDIT_LOCKED_MESSAGE = "Plan active nahi hai — business edit karne ke liye plan activate karein";

// The product catalog (PDF) is only for plans that allow it (Gold, Platinum, Enterprise; not Silver).
export const CATALOG_PLAN_MESSAGE = "Product catalog (PDF) Gold aur Platinum plan me available hai";

type ErrorLike = { message?: string; code?: string } | null | undefined;

/** True when the database refused a catalog write because the plan does not include the catalog. */
export function isCatalogNotAllowedError(err: unknown): boolean {
  const e = err as ErrorLike;
  const message = (e?.message ?? (typeof err === "string" ? err : "")).toLowerCase();
  return message.includes("product catalog (pdf) is available on") || message.includes(CATALOG_PLAN_MESSAGE.toLowerCase());
}

/**
 * True when an error means "the database refused this owner write": a row-level-security violation,
 * or PostgREST's "no rows" for an update that RLS filtered out.
 */
export function isEditLockedError(err: unknown): boolean {
  const e = err as ErrorLike;
  const message = (e?.message ?? (typeof err === "string" ? err : "")).toLowerCase();
  return (
    message.includes("row-level security") ||
    message.includes("violates row-level") ||
    message.includes(EDIT_LOCKED_MESSAGE.toLowerCase()) ||
    e?.code === "PGRST116" ||
    (e?.code === "42501" && message.includes("policy"))
  );
}

/** The text to show for a failed owner save: the friendly lock message, else `fallback` (or the error text). */
export function friendlyEditError(err: unknown, fallback?: string): string {
  if (isEditLockedError(err)) return EDIT_LOCKED_MESSAGE;
  if (fallback) return fallback;
  return err instanceof Error ? err.message : "Something went wrong.";
}

const FIELD_LABEL: Record<string, string> = {
  name: "Name", description: "Description", price: "Price", discountPrice: "Discount price", stock: "Stock",
  category: "Category", imageUrls: "Images", businessId: "Business",
};

/**
 * A server function whose input check fails throws a ZodError BEFORE its handler runs; over the wire that arrives as an
 * Error whose message is the JSON list of issues. Turn it into one readable line ("Name: must be at least 2 characters").
 * Returns null when `err` is not such an error.
 */
export function readValidationError(err: unknown): string | null {
  const text = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!text.trimStart().startsWith("[")) return null;
  try {
    const issues = JSON.parse(text) as Array<{ path?: Array<string | number>; message?: string }>;
    if (!Array.isArray(issues) || issues.length === 0 || !issues.every((i) => typeof i?.message === "string")) return null;
    return issues
      .map((i) => {
        const field = String(i.path?.[0] ?? "");
        return field ? `${FIELD_LABEL[field] ?? field}: ${i.message}` : (i.message as string);
      })
      .join(" · ");
  } catch {
    return null;
  }
}
