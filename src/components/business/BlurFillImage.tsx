import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBusinessPhotoSrc } from "./BusinessPhotoImage";
import { SafeImage } from "./SafeImage";

/** Photos that are not in the first view are signed at the latest this long after they appear. */
const LATE_MS = 5000;

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
  width,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  loading?: "eager" | "lazy";
  fallback?: ReactNode;
  /** Extra classes for the sharp picture only (e.g. a hover zoom). */
  imgClassName?: string;
  /** Ask for a resized picture of about this width (2x the width it is shown at); the full file is used if that fails. */
  width?: number;
  /** The picture the page is judged on (first cards): loaded at once (eager) and fetched first (fetchpriority high). */
  priority?: boolean;
}) {
  // A resized photo is signed with its own request (+ a CORS preflight), and a row has 20+ cards. Asking for all of them at once made the
  // first card's photo (the one the page is judged on) wait in the same queue. So: the priority / eager photo is signed at once; the others
  // when they come near the screen, or at the latest after LATE_MS (a card inside a swipe row is clipped by the row, so it only "comes near"
  // when swiped to; by then its photo is usually ready already).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(priority || loading === "eager" || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (near) return;
    const el = wrapRef.current;
    // At the latest after LATE_MS, and then only when the browser is idle: a burst of 20 sign-ins right while the first photo arrives made
    // that photo wait for the main thread (measured: loaded at 13.4 s, painted at 16.2 s on a throttled phone).
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const timer = setTimeout(() => (ric ? ric(() => setNear(true), { timeout: 2000 }) : setNear(true)), LATE_MS);
    let io: IntersectionObserver | null = null;
    if (el) {
      io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setNear(true); }, { rootMargin: "300px" });
      io.observe(el);
    }
    return () => { clearTimeout(timer); io?.disconnect(); };
  }, [near]);
  const { src: resolved, fallBackToOriginal } = useBusinessPhotoSrc(near ? src : null, width);
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

  if (!resolved || failedSrc === resolved) return <div ref={wrapRef} className="h-full w-full">{fallback ?? null}</div>;

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
          decoding="async"
          data-blur-layer
          className="absolute inset-0 h-full w-full scale-[1.2] object-cover blur-[20px] brightness-90 saturate-[1.2]"
        />
      )}
      <SafeImage
        src={resolved}
        alt={alt}
        loading={priority ? "eager" : loading}
        fetchPriority={priority ? "high" : undefined}
        className={`relative h-full w-full transition-opacity duration-200 ${
          known === null ? "object-contain opacity-0" : tall ? "object-cover object-center" : "object-contain"
        } ${imgClassName}`}
        onFail={() => { if (!fallBackToOriginal()) setFailedSrc(resolved); }}
        onLoad={(img) => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) setShape({ src: resolved, ratio: img.naturalWidth / img.naturalHeight });
        }}
      />
    </div>
  );
}
