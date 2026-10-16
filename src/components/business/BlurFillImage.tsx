import { useState, type ReactNode } from "react";
import { useResolvedBusinessPhotoSrc } from "./BusinessPhotoImage";
import { SafeImage } from "./SafeImage";

/**
 * A business photo that fills its box (give the parent a fixed size / aspect ratio) without cropping and without
 * empty side space: the whole picture is shown centred (object-contain) over a blurred, slightly darkened copy of
 * itself that fills the box. Both <img> use the same URL, so the browser fetches the file once.
 * No picture, or one that fails to load: `fallback`.
 */
export function BlurFillImage({
  src,
  alt,
  loading = "lazy",
  fallback,
  imgClassName = "",
}: {
  src: string | null | undefined;
  alt: string;
  loading?: "eager" | "lazy";
  fallback?: ReactNode;
  /** Extra classes for the sharp picture only (e.g. a hover zoom). */
  imgClassName?: string;
}) {
  const resolved = useResolvedBusinessPhotoSrc(src);
  // Remember WHICH url failed, so a changed photo is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!resolved || failedSrc === resolved) return <>{fallback ?? null}</>;

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted">
      <img
        src={resolved}
        alt=""
        aria-hidden
        loading={loading}
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-[16px] brightness-90"
      />
      <SafeImage
        src={resolved}
        alt={alt}
        loading={loading}
        className={`relative h-full w-full object-contain ${imgClassName}`}
        onFail={() => setFailedSrc(resolved)}
      />
    </div>
  );
}
