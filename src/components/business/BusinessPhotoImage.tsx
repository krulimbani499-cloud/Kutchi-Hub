import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_PHOTOS_BUCKET, SIGNED_BUSINESS_PHOTO_TTL_SECONDS, getBusinessPhotoStorageKey } from "@/lib/business-photos";

interface BusinessPhotoImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fallback?: ReactNode;
}

export function BusinessPhotoImage({ src, alt, className, loading, fallback }: BusinessPhotoImageProps) {
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
    supabase.storage
      .from(BUSINESS_PHOTOS_BUCKET)
      .createSignedUrl(key, SIGNED_BUSINESS_PHOTO_TTL_SECONDS)
      .then(({ data, error }) => {
        if (!cancelled) setResolvedSrc(error ? "" : data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolvedSrc) return <>{fallback ?? null}</>;

  return <img src={resolvedSrc} alt={alt} className={className} loading={loading} />;
}