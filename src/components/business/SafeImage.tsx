import { useEffect, useRef } from "react";

/**
 * <img> that reports a load failure through `onFail`, including a failure that happened before React
 * attached its handler (images in server-rendered HTML can fail before hydration, and that error event is lost).
 * `onLoad` is the same for a successful load (it also fires for an image that was already complete).
 */
export function SafeImage({
  src,
  className,
  alt = "",
  loading,
  onFail,
  onLoad,
}: {
  src: string;
  className?: string;
  alt?: string;
  loading?: "lazy" | "eager";
  onFail: () => void;
  onLoad?: (img: HTMLImageElement) => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.complete) return;
    if (el.naturalWidth === 0) onFail();
    else onLoad?.(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={onFail}
      onLoad={(e) => onLoad?.(e.currentTarget)}
    />
  );
}
