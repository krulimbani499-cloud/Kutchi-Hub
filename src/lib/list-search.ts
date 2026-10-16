// Search used by the owner dashboard and the admin business lists (runs on the list already loaded in the browser).

/** Lower case, no accents, extra spaces collapsed. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits of a phone number; a country code / leading 0 is dropped (only the last 10 digits are compared). */
function phoneDigits(value: string): string {
  const d = value.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export type Searchable = {
  /** Name, city, category, slug, email… matched as text. */
  text?: Array<string | null | undefined>;
  /** Phone numbers, matched on digits only, so "95103" finds "95103 45341". */
  phones?: Array<string | null | undefined>;
};

/**
 * Every word of the query must be found: in one of the text fields, or (for numbers of 3+ digits) in a phone number.
 * A query that is only digits / spaces / "+" / "-" is also tried as one phone number, so "+91 95103 45341" works.
 */
export function matchesSearch(query: string, item: Searchable): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const texts = (item.text ?? []).map(normalizeText).filter(Boolean);
  const phones = (item.phones ?? []).map((p) => phoneDigits(p ?? "")).filter(Boolean);

  if (/^[\d\s+\-()]+$/.test(q)) {
    const whole = phoneDigits(q);
    if (whole.length >= 3 && phones.some((p) => p.includes(whole))) return true;
  }
  return q.split(" ").every((word) => {
    if (texts.some((t) => t.includes(word))) return true;
    const digits = word.replace(/\D/g, "");
    return digits.length >= 3 && digits.length === word.replace(/[+\-()]/g, "").length && phones.some((p) => p.includes(phoneDigits(digits)));
  });
}
