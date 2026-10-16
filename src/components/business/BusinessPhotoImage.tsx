import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_PHOTOS_BUCKET, SIGNED_BUSINESS_PHOTO_TTL_SECONDS, getBusinessPhotoStorageKey } from "@/lib/business-photos";

// One signed URL per stored photo, shared by every <img> on the page. The same photo often appears more than once
// (hero, thumbnail, photo grid); with a fresh signed URL each time the browser would download it once per copy.
const signedUrls = new Map<string, { url: Promise<string>; expires: number }>();

function signedUrlFor(key: string): Promise<string> {
  const hit = signedUrls.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const url = supabase.storage
    .from(BUSINESS_PHOTOS_BUCKET)
    .createSignedUrl(key, SIGNED_BUSINESS_PHOTO_TTL_SECONDS)
    .then(({ data, error }) => {
      if (error) {
        signedUrls.delete(key); // try again next time
        return "";
      }
      return data.signedUrl;
    });
  // Reused for most of the URL's lifetime, never right up to its expiry.
  signedUrls.set(key, { url, expires: Date.now() + SIGNED_BUSINESS_PHOTO_TTL_SECONDS * 1000 * 0.5 });
  return url;
}

/** A stored photo (storage key or full URL) as a URL an <img> can load; "" while a signed URL is being fetched. */
export function useResolvedBusinessPhotoSrc(src: string | null | undefined): string {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    const key = getBusinessPhotoStorageKey(src);
    return key ? "" : src ?? "";
  });

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

    setResolvedSrc("");
    signedUrlFor(key).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return resolvedSrc;
}

interface BusinessPhotoImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fallback?: ReactNode;
}

export function BusinessPhotoImage({ src, alt, className, loading, fallback }: BusinessPhotoImageProps) {
  const resolvedSrc = useResolvedBusinessPhotoSrc(src);

  if (!resolvedSrc) return <>{fallback ?? null}</>;

  return <img src={resolvedSrc} alt={alt} className={className} loading={loading} />;
}
