import { useEffect, useRef } from "react";

/**
 * <img> that reports a load failure through `onFail`, including a failure that happened before React
 * attached its handler (images in server-rendered HTML can fail before hydration, and that error event is lost).
 */
export function SafeImage({
  src,
  className,
  alt = "",
  loading,
  onFail,
}: {
  src: string;
  className?: string;
  alt?: string;
  loading?: "lazy" | "eager";
  onFail: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) onFail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return <img ref={ref} src={src} alt={alt} loading={loading} className={className} onError={onFail} />;
}
