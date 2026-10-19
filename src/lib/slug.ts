// Canonical URL slug: lowercase, every run of non-alphanumeric characters becomes a
// single hyphen, no leading/trailing hyphens.
export function slugify(value: string, maxLength = 120): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

// For live typing in an input: normalises as you type but keeps a trailing hyphen, so
// "my-" can become "my-shop". Run slugify() on blur and on submit.
export function slugifyInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "");
}

// Business slugs must never be rejected: names with no Latin letters or digits (e.g. Gujarati
// or Hindi only) slugify to nothing, so fall back to "business-" + 8 characters of a random id.
export function ensureSlug(value: string, maxLength = 120): string {
  const slug = slugify(value, maxLength);
  if (slug.length >= 2) return slug;
  return `business-${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/**
 * `base` if nobody uses it, otherwise `base-2`, `base-3`, ... (the first free one). `taken` is every slug already in use.
 * The suffix always fits: a long base is shortened so the result never passes `maxLength`.
 */
export function pickUniqueSlug(base: string, taken: ReadonlySet<string>, maxLength = 120): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, maxLength - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, maxLength - 9).replace(/-+$/g, "")}-${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
