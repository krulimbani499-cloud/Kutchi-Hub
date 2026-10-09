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
