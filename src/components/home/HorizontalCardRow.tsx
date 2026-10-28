import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * One horizontally swipeable row of cards (scroll-snap). Phones: each card is ~80% wide so the next one
 * peeks in. md and up: fixed 300px cards plus left/right arrow buttons. Only the row scrolls sideways,
 * never the page. Put it inside a padded box: it bleeds to the box edges (-mx) and pads itself back,
 * so the first card lines up with the box padding and the last one is not stuck to the edge.
 *
 * variant="tiles": the same row for small tiles (home Popular Categories): about 4 tiles and a bit of the 5th on a 360px phone,
 * wider tiles from sm up, arrows on md and up that move several tiles at a time.
 */
export function HorizontalCardRow({ children, variant = "cards" }: { children: ReactNode; variant?: "cards" | "tiles" }) {
  const tiles = variant === "tiles";
  const rowRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ atStart: true, atEnd: true });
  const count = Children.count(children);

  const update = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft >= max - 1 });
  }, []);

  useEffect(() => {
    update();
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, count]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = rowRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-row-card]");
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
    const step = (card?.offsetWidth ?? 300) + gap;
    // Tiles are small: move about a screenful (all but one of the visible tiles) per click.
    const tilesPerClick = tiles ? Math.max(1, Math.floor(el.clientWidth / step) - 1) : 1;
    el.scrollBy({ left: direction * step * tilesPerClick, behavior: "smooth" });
  };

  const scrollable = !(edge.atStart && edge.atEnd);
  // A single card is shown normally (full width on phones) instead of leaving a gap.
  // Phones: the row minus 20px of its content width, i.e. ~82% of the visible row, so the next card always peeks ~28px.
  const cardWidth = tiles
    ? "w-[66px] sm:w-[84px] md:w-[104px]"
    : count === 1
      ? "w-full sm:w-[300px]"
      : "w-[calc(100%-20px)] max-w-[300px] md:w-[300px] md:max-w-none";
  const arrow =
    "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-opacity hover:bg-muted disabled:pointer-events-none disabled:opacity-0 md:flex";

  return (
    <div className="relative -mx-5 sm:-mx-6">
      <div
        ref={rowRef}
        role="list"
        tabIndex={0}
        onScroll={update}
        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-pl-5 px-5 pb-2 pt-1 outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-primary/50 sm:scroll-pl-6 sm:px-6 [&::-webkit-scrollbar]:hidden ${tiles ? "gap-1.5 sm:gap-2 md:gap-3" : "gap-3 sm:gap-4"}`}
      >
        {Children.map(children, (child) => (
          <div role="listitem" data-row-card className={`flex shrink-0 snap-start flex-col [&>*]:flex-1 ${cardWidth}`}>
            {child}
          </div>
        ))}
      </div>

      {scrollable && (
        <>
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByCard(-1)}
            disabled={edge.atStart}
            className={`${arrow} left-2`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByCard(1)}
            disabled={edge.atEnd}
            className={`${arrow} right-2`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
