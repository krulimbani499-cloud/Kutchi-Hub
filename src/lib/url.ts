import { z } from "zod";

export const WEBSITE_ERROR = "Enter a valid website, e.g. www.yourshop.com";
export const SOCIAL_ERROR = "Enter a valid link, e.g. instagram.com/yourshop";
export const MAPS_ERROR = "Enter a valid Google Maps link";

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i;

// Trim; add https:// when no http(s):// is present; lower-case the scheme. http:// is kept as typed.
export const normalizeUrl = (value: string): string => {
  const t = value.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t.replace(/^(https?):/i, (_, s: string) => `${s.toLowerCase()}:`);
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
};

export const isValidWebUrl = (value: string): boolean => {
  if (/\s/.test(value)) return false;
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password && HOST.test(u.hostname);
  } catch {
    return false;
  }
};

// Shared by the client form and the server schema so both always agree.
export const optionalUrl = (message: string) =>
  z
    .string()
    .transform(normalizeUrl)
    .pipe(z.string().max(500).refine((v) => v === "" || isValidWebUrl(v), message))
    .optional();

export const requiredUrl = (message: string) =>
  z.string().transform(normalizeUrl).pipe(z.string().max(500).refine(isValidWebUrl, message));

// ---- Catalog / product links (Google Drive, a website page, ...): https:// ONLY ----
export const LINK_ERROR = "Enter a valid https:// link, e.g. https://drive.google.com/...";

/**
 * Trim. A link typed without any scheme ("drive.google.com/x") gets https://; the scheme is lower-cased. Any OTHER scheme
 * (http:, javascript:, data:, ftp:, mailto: ...) is kept as typed so that it fails the check below instead of being "fixed".
 */
export const normalizeHttpsLink = (value: string): string => {
  const t = value.trim();
  if (!t) return "";
  if (/^https:\/\//i.test(t)) return t.replace(/^https:/i, "https:");
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
};

/** A normal https:// address: no spaces, no user:password@, a real host name, at most 500 characters. */
export const isValidHttpsLink = (value: string): boolean => {
  if (value.length > 500 || /\s/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && HOST.test(u.hostname);
  } catch {
    return false;
  }
};

/** Shared by the client form and the server schema. "" = no link. */
export const httpsLink = () =>
  z
    .string()
    .transform(normalizeHttpsLink)
    .pipe(z.string().max(500).refine((v) => v === "" || isValidHttpsLink(v), LINK_ERROR))
    .optional();

/** The address to put in an href, or null when it is empty or not a plain https:// link (stored data is re-checked when shown). */
export const safeHttpsHref = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const v = value.trim();
  return /^https:\/\//i.test(v) && isValidHttpsLink(v) ? v : null;
};

/** Google Drive / Docs links only work for other people when sharing is "Anyone with the link". */
export const isGoogleDriveLink = (value: string): boolean => {
  try {
    const h = new URL(normalizeHttpsLink(value)).hostname.toLowerCase();
    return h === "drive.google.com" || h === "docs.google.com" || h.endsWith(".drive.google.com") || h.endsWith(".docs.google.com");
  } catch {
    return false;
  }
};
export const DRIVE_HINT = "Make sure sharing is set to 'Anyone with the link'.";
