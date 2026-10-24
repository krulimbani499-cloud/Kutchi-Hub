import { ReactNode, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_PHOTOS_BUCKET, SIGNED_BUSINESS_PHOTO_TTL_SECONDS, getBusinessPhotoStorageKey } from "@/lib/business-photos";

// ---- Signed URLs for stored photos ------------------------------------------------------------------------------------
// One signed URL per stored photo, shared by every <img> on the page, and now:
//   - BATCHED: every photo asked for within a few milliseconds is signed by ONE request (createSignedUrls), not one request
//     per card (a page with 20 businesses used to make 20 round trips to Supabase before a single picture could start).
//   - REMEMBERED on the device (localStorage) for half the URL's life, so the next page / visit needs no signing call at all
//     and the browser can reuse the picture it already downloaded (the URL stays the same).
//   - RESIZED on request: a card only needs ~640 px, not the 1-4 MB original from a phone camera. The same signed token is
//     used with Supabase's image endpoint (/render/image/sign) and a width.
type Cached = { url: string; expires: number };

const STORE_KEY = "kh:signed-photos:v1";
const MAX_STORED = 400;
const FLUSH_MS = 15;
const REUSE_MS = SIGNED_BUSINESS_PHOTO_TTL_SECONDS * 1000 * 0.5;

const memory = new Map<string, Cached>();
const pending = new Map<string, Promise<string>>();
let queue: Array<{ key: string; resolve: (url: string) => void }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let storeLoaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
// If the resized pictures ever fail to load (image resizing switched off in Supabase), everything falls back to the originals.
let resizeBroken = false;

function loadStore() {
  if (storeLoaded || typeof window === "undefined") return;
  storeLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const now = Date.now();
    for (const [key, v] of Object.entries(JSON.parse(raw) as Record<string, Cached>)) {
      if (v && typeof v.url === "string" && v.expires > now) memory.set(key, v);
    }
  } catch {
    /* storage unavailable or corrupt: just sign again */
  }
}

function saveStoreSoon() {
  if (typeof window === "undefined" || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const now = Date.now();
      const entries = [...memory.entries()].filter(([, v]) => v.expires > now).slice(-MAX_STORED);
      window.localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* quota / private mode: ignore */
    }
  }, 1000);
}

async function flush() {
  flushTimer = null;
  const batch = queue;
  queue = [];
  if (batch.length === 0) return;
  const keys = [...new Set(batch.map((b) => b.key))];
  const urls = new Map<string, string>();
  try {
    const { data, error } = await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).createSignedUrls(keys, SIGNED_BUSINESS_PHOTO_TTL_SECONDS);
    if (!error) for (const row of data ?? []) if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
  } catch {
    /* every waiter below gets "" and the picture simply does not show (as when one signing call failed before) */
  }
  for (const { key, resolve } of batch) {
    const url = urls.get(key) ?? "";
    if (url) memory.set(key, { url, expires: Date.now() + REUSE_MS });
    pending.delete(key);
    resolve(url);
  }
  saveStoreSoon();
}

function cachedUrl(key: string): string | null {
  loadStore();
  const hit = memory.get(key);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

function signedUrlFor(key: string): Promise<string> {
  const hit = cachedUrl(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const promise = new Promise<string>((resolve) => {
    queue.push({ key, resolve });
    if (!flushTimer) flushTimer = setTimeout(() => void flush(), FLUSH_MS);
  });
  pending.set(key, promise);
  return promise;
}

/** The resized version of a signed URL (same token, Supabase image endpoint). Other URLs are returned unchanged. */
export function resizedSignedUrl(url: string, width: number): string {
  if (resizeBroken || !url.includes("/storage/v1/object/sign/")) return url;
  return `${url.replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/")}&width=${Math.round(width)}&quality=72`;
}

/** A public (non-signed) storage picture as a resized one, e.g. category icons. */
export function resizedPublicUrl(url: string, width: number): string {
  if (resizeBroken || !url.includes("/storage/v1/object/public/")) return url;
  return `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${Math.round(width)}&quality=72`;
}

/** Call when a resized picture failed to load: from now on the originals are used. */
export function markResizeBroken() {
  resizeBroken = true;
}

/**
 * A stored photo (storage key or full URL) as a URL an <img> can load; "" while a signed URL is being fetched.
 * `width` asks for a resized picture (about twice the size it is shown at). `fallBackToOriginal()` lets the caller fall back to the
 * full-size file when the resized one fails.
 */
export function useBusinessPhotoSrc(src: string | null | undefined, width?: number): { src: string; fallBackToOriginal: () => boolean } {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    const key = getBusinessPhotoStorageKey(src);
    return key ? "" : src ?? "";
  });
  const [original, setOriginal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = getBusinessPhotoStorageKey(src);

    if (!src) {
      setResolvedSrc("");
      return;
    }

    if (!key) {
      setResolvedSrc(src);
      return;
    }

    // Already signed on this device: no waiting, no request.
    const known = cachedUrl(key);
    if (known) {
      setResolvedSrc(known);
      return;
    }
    setResolvedSrc("");
    void signedUrlFor(key).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const fallBackToOriginal = useCallback(() => {
    if (original || !width) return false;
    markResizeBroken();
    setOriginal(true);
    return true;
  }, [original, width]);

  const final = resolvedSrc && width && !original ? resizedSignedUrl(resolvedSrc, width) : resolvedSrc;
  return { src: final, fallBackToOriginal };
}

/** Same as useBusinessPhotoSrc, for callers that only need the URL. */
export function useResolvedBusinessPhotoSrc(src: string | null | undefined, width?: number): string {
  return useBusinessPhotoSrc(src, width).src;
}

interface BusinessPhotoImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fallback?: ReactNode;
  /** Ask for a resized picture of about this width (2x the displayed width is a good value). */
  width?: number;
}

export function BusinessPhotoImage({ src, alt, className, loading, fallback, width }: BusinessPhotoImageProps) {
  const { src: resolvedSrc, fallBackToOriginal } = useBusinessPhotoSrc(src, width);

  if (!resolvedSrc) return <>{fallback ?? null}</>;

  return <img src={resolvedSrc} alt={alt} className={className} loading={loading} decoding="async" onError={() => void fallBackToOriginal()} />;
}
