import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { BusinessPhotoImage, useResolvedBusinessPhotoSrc } from "./BusinessPhotoImage";

export type LightboxPhoto = { id: string; url: string; caption?: string | null };

const SWIPE_MIN_PX = 50;

/** Fetch a neighbouring photo into the browser cache (through the shared signed-URL cache) so next/prev feels instant. */
function Preload({ src }: { src: string }) {
  const resolved = useResolvedBusinessPhotoSrc(src);
  useEffect(() => {
    if (!resolved) return;
    const img = new Image();
    img.src = resolved;
  }, [resolved]);
  return null;
}

/**
 * Full-screen photo viewer. Arrows, keyboard (← → Esc), swipe on touch screens, "2 / 5" counter.
 * It is a role="dialog", so the Android hardware Back button closes it (NativeBackButton dispatches Escape to any open dialog).
 * Only the photo on screen is loaded, plus its two neighbours.
 */
export function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const total = photos.length;
  const current = photos[index];
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const go = (delta: number) => onIndexChange((index + delta + total) % total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (total > 1 && e.key === "ArrowRight") onIndexChange((index + 1) % total);
      if (total > 1 && e.key === "ArrowLeft") onIndexChange((index - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, total, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        const t = e.changedTouches[0];
        if (!start || !t || total < 2) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // A mostly-horizontal swipe changes photo; a tap or a vertical scroll does nothing here.
        if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <div className="relative flex max-h-[90vh] max-w-[92vw] items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <BusinessPhotoImage
          key={current.id}
          src={current.url}
          alt={current.caption ?? `Photo ${index + 1}`}
          className="max-h-[85vh] max-w-[92vw] select-none rounded-lg object-contain"
        />
      </div>
      {total > 1 && (
        <>
          <Preload key={`next-${photos[(index + 1) % total].id}`} src={photos[(index + 1) % total].url} />
          <Preload key={`prev-${photos[(index - 1 + total) % total].id}`} src={photos[(index - 1 + total) % total].url} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {index + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
}
