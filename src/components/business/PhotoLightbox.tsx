import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, X } from "lucide-react";
import { useBusinessPhotoSrc, useResolvedBusinessPhotoSrc } from "./BusinessPhotoImage";

export type LightboxPhoto = { id: string; url: string; caption?: string | null };

/** Width of the picture asked from storage: sharp on a phone screen and when zoomed in, never cropped (resize=contain). */
const FULL_WIDTH = 1800;
const MAX_SCALE = 5;
const MIN_PINCH_SCALE = 0.7; // while pinching in; it springs back to 1 on release
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_PX = 60; // sideways drag that changes the photo
const CLOSE_PX = 110; // downward (or upward) drag that closes the viewer
const TAP_MOVE_PX = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 30;

type Pt = { x: number; y: number };
type Mode = null | "pan" | "swipe-x" | "swipe-y" | "none";

/** Fetch a neighbouring photo into the browser cache (same size as the viewer asks for) so next / prev feels instant. */
function Preload({ src }: { src: string }) {
  const resolved = useResolvedBusinessPhotoSrc(src, FULL_WIDTH);
  useEffect(() => {
    if (!resolved) return;
    const img = new Image();
    img.src = resolved;
  }, [resolved]);
  return null;
}

/**
 * One photo with touch + mouse gestures (pointer events, so the same code serves the phone, the Android / iOS WebView and desktop):
 *  - two fingers: pinch to zoom (and move while pinching); the wheel zooms on desktop
 *  - double tap / double click: zoom in at that spot, again to zoom out
 *  - zoomed in: one finger / mouse drags the photo around
 *  - not zoomed: drag sideways = next / previous photo, drag down (or up) = close
 * Everything is kept in refs and written straight to the element, so a gesture never re-renders React.
 */
function ZoomableImage({
  photo,
  canSwipe,
  onNavigate,
  onClose,
}: {
  photo: LightboxPhoto;
  canSwipe: boolean;
  onNavigate: (delta: number) => void;
  onClose: () => void;
}) {
  const { src, fallBackToOriginal } = useBusinessPhotoSrc(photo.url, FULL_WIDTH);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const view = useRef({ s: 1, x: 0, y: 0 });
  const drag = useRef<Pt>({ x: 0, y: 0 }); // follows the finger while swiping at scale 1
  const pointers = useRef(new Map<number, Pt>());
  const single = useRef<{ start: Pt; v0: Pt; mode: Mode; t: number; noTap: boolean; onBackdrop: boolean; mouse: boolean } | null>(null);
  const pinch = useRef<{ d0: number; s0: number; c: Pt } | null>(null);
  const lastTap = useRef<{ t: number; p: Pt } | null>(null);

  const apply = (animate = false) => {
    const el = imgRef.current;
    if (!el) return;
    const { s, x, y } = view.current;
    el.style.transition = animate ? "transform 180ms ease-out" : "none";
    el.style.transform = `translate3d(${x + drag.current.x}px, ${y + drag.current.y}px, 0) scale(${s})`;
  };

  /** Keep the zoomed photo from being dragged away from the screen. */
  const clamp = (s: number, x: number, y: number) => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage || s <= 1) return { s, x: s < 1 ? x : 0, y: s < 1 ? y : 0 };
    const bx = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
    const by = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
    return { s, x: Math.min(bx, Math.max(-bx, x)), y: Math.min(by, Math.max(-by, y)) };
  };

  /** A screen point relative to the centre of the stage (the photo scales around its centre). */
  const rel = (p: Pt): Pt => {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { x: p.x - (r.left + r.width / 2), y: p.y - (r.top + r.height / 2) } : p;
  };

  /** Zoom to `target`, keeping the picture point under `m` where it is. */
  const zoomAt = (m: Pt, target: number, animate: boolean) => {
    const { s, x, y } = view.current;
    const next = Math.min(MAX_SCALE, Math.max(1, target));
    if (next === 1) {
      view.current = { s: 1, x: 0, y: 0 };
    } else {
      const cx = (m.x - x) / s;
      const cy = (m.y - y) / s;
      view.current = clamp(next, m.x - cx * next, m.y - cy * next);
    }
    apply(animate);
  };

  const startSingle = (p: Pt, e?: React.PointerEvent, noTap = false) => {
    single.current = {
      start: p,
      v0: { x: view.current.x, y: view.current.y },
      mode: null,
      t: Date.now(),
      noTap,
      onBackdrop: !!e && e.target === e.currentTarget,
      mouse: e?.pointerType === "mouse",
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      startSingle({ x: e.clientX, y: e.clientY }, e);
    } else if (pointers.current.size === 2) {
      // Second finger: this is a pinch from now on.
      single.current = null;
      drag.current = { x: 0, y: 0 };
      const [a, b] = [...pointers.current.values()];
      const m = rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const { s, x, y } = view.current;
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, c: { x: (m.x - x) / s, y: (m.y - y) / s } };
      apply();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const s = Math.min(MAX_SCALE, Math.max(MIN_PINCH_SCALE, pinch.current.s0 * (d / pinch.current.d0)));
      const m = rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const c = pinch.current.c;
      view.current = clamp(s, m.x - c.x * s, m.y - c.y * s);
      apply();
      return;
    }

    const g = single.current;
    if (!g) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (g.mode === null && Math.hypot(dx, dy) > TAP_MOVE_PX) {
      if (view.current.s > 1.02) g.mode = "pan";
      else if (Math.abs(dx) > Math.abs(dy)) g.mode = canSwipe ? "swipe-x" : "none";
      else g.mode = "swipe-y";
    }
    if (g.mode === "pan") {
      view.current = clamp(view.current.s, g.v0.x + dx, g.v0.y + dy);
      apply();
    } else if (g.mode === "swipe-x") {
      drag.current = { x: dx, y: 0 };
      apply();
    } else if (g.mode === "swipe-y") {
      drag.current = { x: 0, y: dy };
      apply();
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    const pos = { x: e.clientX, y: e.clientY };
    pointers.current.delete(e.pointerId);

    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        if (view.current.s < 1) {
          view.current = { s: 1, x: 0, y: 0 };
          apply(true);
        }
        // One finger is still down: carry on as a drag from where it is now (no tap / double tap from it).
        const rest = [...pointers.current.values()][0];
        if (rest) startSingle(rest, undefined, true);
      }
      return;
    }

    const g = single.current;
    single.current = null;
    if (!g || cancelled) {
      drag.current = { x: 0, y: 0 };
      apply(true);
      return;
    }

    if (g.mode === "swipe-x") {
      const dx = drag.current.x;
      drag.current = { x: 0, y: 0 };
      if (Math.abs(dx) > SWIPE_PX) onNavigate(dx < 0 ? 1 : -1);
      else apply(true);
    } else if (g.mode === "swipe-y") {
      const dy = drag.current.y;
      if (Math.abs(dy) > CLOSE_PX) onClose();
      else {
        drag.current = { x: 0, y: 0 };
        apply(true);
      }
    } else if (g.mode === null && !g.noTap) {
      // A tap. Two quick taps in the same place = zoom in / out.
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(pos.x - prev.p.x, pos.y - prev.p.y) < DOUBLE_TAP_DIST) {
        lastTap.current = null;
        if (view.current.s > 1.02) zoomAt({ x: 0, y: 0 }, 1, true);
        else zoomAt(rel(pos), DOUBLE_TAP_SCALE, true);
      } else {
        lastTap.current = { t: now, p: pos };
        // A mouse click on the empty black area closes (a finger tap does not: the X button / swipe down / Back do).
        if (g.mouse && g.onBackdrop && view.current.s <= 1.02) {
          const tapAt = lastTap.current;
          window.setTimeout(() => {
            if (lastTap.current === tapAt) onClose();
          }, DOUBLE_TAP_MS);
        }
      }
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    zoomAt(rel({ x: e.clientX, y: e.clientY }), view.current.s * Math.exp(-e.deltaY * 0.0015), false);
  };

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPointer(e, false)}
      onPointerCancel={(e) => endPointer(e, true)}
      onWheel={onWheel}
    >
      {!loaded && !failed && (
        <Loader2 className="pointer-events-none absolute h-8 w-8 animate-spin text-white/70" aria-label="Loading photo" />
      )}
      {failed && (
        <div className="pointer-events-none flex flex-col items-center gap-2 text-sm text-white/70">
          <ImageOff className="h-8 w-8" />
          Photo could not be loaded
        </div>
      )}
      {src && !failed && (
        <img
          ref={imgRef}
          src={src}
          alt={photo.caption ?? "Photo"}
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // The resized picture failed: the hook switches to the original file; only when that fails too is the photo lost.
            if (!fallBackToOriginal()) setFailed(true);
          }}
          className={`max-h-[100dvh] max-w-[100vw] select-none object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ willChange: "transform", WebkitTouchCallout: "none" }}
        />
      )}
    </div>
  );
}

const ROUND_BTN =
  "flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 active:bg-white/30";

/**
 * Full-screen photo viewer on a black background: pinch / double-tap zoom, pan, swipe to the next photo, swipe down to close,
 * "3 / 8" counter, arrows (wide screens) and keyboard (← → Esc).
 * It is a role="dialog", so the Android hardware Back button closes it (NativeBackButton dispatches Escape to any open dialog).
 * It is drawn straight into <body>, so no card / transform / overflow around the thumbnail can hide or clip it.
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (total > 1 && e.key === "ArrowRight") onIndexChange((index + 1) % total);
      if (total > 1 && e.key === "ArrowLeft") onIndexChange((index - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onIndexChange]);

  // The page behind must not scroll while the viewer is open.
  useEffect(() => {
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    rootRef.current?.focus();
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overscrollBehavior = prevHtml;
    };
  }, []);

  if (!current || typeof document === "undefined") return null;

  const go = (delta: number) => onIndexChange((index + delta + total) % total);

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] bg-black outline-none animate-fade-in"
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <ZoomableImage key={current.id} photo={current} canSwipe={total > 1} onNavigate={go} onClose={onClose} />

      <button
        type="button"
        onClick={onClose}
        className={`absolute right-3 z-10 ${ROUND_BTN}`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {total > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className={`absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 sm:flex ${ROUND_BTN}`} aria-label="Previous photo">
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button type="button" onClick={() => go(1)} className={`absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 sm:flex ${ROUND_BTN}`} aria-label="Next photo">
            <ChevronRight className="h-7 w-7" />
          </button>
          <Preload key={`next-${photos[(index + 1) % total].id}`} src={photos[(index + 1) % total].url} />
          <Preload key={`prev-${photos[(index - 1 + total) % total].id}`} src={photos[(index - 1 + total) % total].url} />
        </>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        {current.caption && (
          <p className="max-w-full truncate rounded-full bg-black/60 px-3 py-1 text-xs text-white/90">{current.caption}</p>
        )}
        {total > 1 && (
          <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
            {index + 1} / {total}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
