import { useEffect, useRef, useState, type ReactNode } from "react";
import { useResolvedBusinessPhotoSrc } from "./BusinessPhotoImage";
import { SafeImage } from "./SafeImage";

/**
 * A business photo that fills its box (give the parent a fixed size / aspect ratio) with no empty side space.
 * Once the picture has loaded its shape is compared with the box:
 *   - taller than the box (square or portrait): object-cover, centred. Fills the box, a little is cropped at top / bottom.
 *   - as wide as the box or wider: the whole picture (object-contain) over a strongly blurred copy of itself, so a
 *     logo is never cropped and there are no pale bars.
 * The box never changes size; until the picture is known it shows the plain placeholder background.
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
  // Remember WHICH url failed / was measured, so a changed photo is handled again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [shape, setShape] = useState<{ src: string; ratio: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxRatio, setBoxRatio] = useState(4 / 3);

  // The actual box (card 4:3, hero, thumbnail, square grid cell), kept up to date when it is resized.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBoxRatio(r.width / r.height);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [resolved]);

  if (!resolved || failedSrc === resolved) return <>{fallback ?? null}</>;

  const known = shape?.src === resolved ? shape.ratio : null;
  // Wider than (or as wide as) the box -> keep it whole over the blur; taller -> fill the box.
  const wide = known !== null && known >= boxRatio - 0.01;
  const tall = known !== null && !wide;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden bg-muted">
      {wide && (
        <img
          src={resolved}
          alt=""
          aria-hidden
          loading={loading}
          data-blur-layer
          className="absolute inset-0 h-full w-full scale-[1.2] object-cover blur-[20px] brightness-90 saturate-[1.2]"
        />
      )}
      <SafeImage
        src={resolved}
        alt={alt}
        loading={loading}
        className={`relative h-full w-full transition-opacity duration-200 ${
          known === null ? "object-contain opacity-0" : tall ? "object-cover object-center" : "object-contain"
        } ${imgClassName}`}
        onFail={() => setFailedSrc(resolved)}
        onLoad={(img) => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) setShape({ src: resolved, ratio: img.naturalWidth / img.naturalHeight });
        }}
      />
    </div>
  );
}
