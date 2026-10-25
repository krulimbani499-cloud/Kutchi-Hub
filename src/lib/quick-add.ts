// Helpers for the admin "Quick add" lead form and the quick-leads export. Pure functions (no database), shared by server and browser.

/** The 10-digit mobile number inside whatever was typed ("+91 95103-45341", "095103 45341" -> "9510345341"); "" if there is none. */
export function phoneKey(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export type PhoneRow = { phone?: string | null; phone_secondary?: string | null };

/** The first row that already uses this phone number (as primary or second number), whatever the formatting. */
export function findPhoneDuplicate<T extends PhoneRow>(rows: readonly T[], phone: string): T | null {
  const key = phoneKey(phone);
  if (!key) return null;
  return rows.find((r) => phoneKey(r.phone) === key || phoneKey(r.phone_secondary) === key) ?? null;
}

export type LeadCsvRow = {
  name: string;
  contactName: string | null;
  phone: string | null;
  categoryName: string;
  city: string | null;
  leadSource: string | null;
  created_at: string;
};

/** One CSV cell: quoted when it holds a comma, quote or line break; quotes doubled. Also blocks spreadsheet formula injection (= + - @). */
export function csvCell(value: string | null | undefined): string {
  let v = (value ?? "").replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(v) && !/^\+?\d[\d\s\-()]*$/.test(v)) v = `'${v}`;
  return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const LEADS_CSV_HEADER = ["Business", "Contact person", "Phone", "Category", "City", "Source", "Date"];

/** Quick leads as CSV text (header + one line per lead, oldest first so the call list reads in the order they were collected). */
export function buildLeadsCsv(rows: readonly LeadCsvRow[]): string {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const lines = sorted.map((r) =>
    [r.name, r.contactName, r.phone, r.categoryName, r.city, r.leadSource, r.created_at.slice(0, 10)].map(csvCell).join(","),
  );
  return [LEADS_CSV_HEADER.join(","), ...lines].join("\r\n") + "\r\n";
}
