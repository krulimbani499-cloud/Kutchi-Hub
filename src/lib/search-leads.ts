// The "Get the list of top <category> - free" form: validation (browser and server use the same rules) and the CSV for the admin.
// Pure functions (no database), so they can be tested on their own.
import { csvCell } from "./quick-add";
import { normalizeIndianMobile, PHONE_ERROR } from "./phone";

export const LEAD_NAME_ERROR = "Please enter your name";
export const LEAD_CONSENT_ERROR = "Please tick the box so our team may contact you";
export const LEAD_RATE_LIMIT_MESSAGE = "Too many requests from your network. Please try again in a while, or call us.";
export const LEAD_NOT_READY_MESSAGE = "We could not take your request right now. Please call or WhatsApp us and we will send the list.";

export type LeadFormErrors = { name?: string; phone?: string; consent?: string };

/** Checks the form; `phone` in the result is the bare 10 digits to save. `errors` is empty when everything is fine. */
export function validateLeadForm(input: { name: string; phone: string; consent: boolean }): {
  errors: LeadFormErrors;
  name: string;
  phone: string | null;
} {
  const name = input.name.replace(/\s+/g, " ").trim();
  const phone = normalizeIndianMobile(input.phone);
  const errors: LeadFormErrors = {};
  if (name.length < 2 || name.length > 80) errors.name = LEAD_NAME_ERROR;
  if (!phone) errors.phone = PHONE_ERROR;
  if (!input.consent) errors.consent = LEAD_CONSENT_ERROR;
  return { errors, name, phone };
}

/** "Get the list of top Dentists – free". */
export function leadHeading(categoryName?: string | null): string {
  const c = categoryName?.trim();
  return c ? `Get the list of top ${c} – free` : "Get the list of top businesses – free";
}

/** Only the path and query of the page the lead came from, never an address on another site. */
export function cleanSourcePage(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v.slice(0, 300);
}

export type SearchLeadRow = {
  id: string;
  name: string;
  phone: string;
  categoryName: string | null;
  city: string | null;
  sourcePage: string | null;
  createdAt: string;
};

export const SEARCH_LEADS_CSV_HEADER = ["Name", "Phone", "Category", "City", "Page", "Date"];

/** Leads as CSV text (header + one line per lead, newest first). */
export function buildSearchLeadsCsv(rows: readonly SearchLeadRow[]): string {
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lines = sorted.map((r) =>
    [r.name, r.phone, r.categoryName, r.city, r.sourcePage, r.createdAt.slice(0, 10)].map(csvCell).join(","),
  );
  return [SEARCH_LEADS_CSV_HEADER.join(","), ...lines].join("\r\n") + "\r\n";
}
