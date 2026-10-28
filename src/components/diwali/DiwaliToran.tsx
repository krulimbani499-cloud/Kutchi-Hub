import { useEffect, useState } from "react";

const TILE = 32; // px: one hanging diya per tile

/** One tile of the toran: a swag of thread, a short hanger and a small diya whose flame flickers (CSS, see styles.css). */
function Diya() {
  return (
    <svg className="diwali-diya shrink-0" width={TILE} height="26" viewBox="0 0 32 26" focusable="false">
      <path d="M0 1 Q16 7 32 1" fill="none" stroke="#d97706" strokeWidth="1.2" />
      <line x1="16" y1="4" x2="16" y2="8" stroke="#d97706" strokeWidth="0.8" />
      <circle cx="16" cy="13" r="9" fill="url(#diwali-glow)" />
      <g className="diwali-flame">
        <path d="M16 6.5 C18.8 9.6 18.5 12.6 16 13.8 C13.5 12.6 13.2 9.6 16 6.5 Z" fill="url(#diwali-flame)" />
        <path d="M16 9.6 C17.1 10.9 16.9 12.2 16 12.7 C15.1 12.2 14.9 10.9 16 9.6 Z" fill="#fff7c2" />
      </g>
      <path d="M9 14 H23 C22.5 18.6 19.5 21.4 16 21.4 C12.5 21.4 9.5 18.6 9 14 Z" fill="url(#diwali-bowl)" />
      <ellipse cx="16" cy="14" rx="7" ry="1.2" fill="#fbbf24" />
      <circle cx="13" cy="17" r="0.7" fill="#fde68a" />
      <circle cx="16" cy="18.4" r="0.7" fill="#fde68a" />
      <circle cx="19" cy="17" r="0.7" fill="#fde68a" />
    </svg>
  );
}

/**
 * The diya toran under the header: a thin strip of small hanging diyas with flickering flames. Pure SVG + CSS, no images.
 * It is drawn OVER the page (absolute, under the header's bottom edge), so it takes no space and moves nothing; it ignores
 * taps (pointer-events: none) and is hidden from screen readers. Reduced motion: the diyas stay, the flames stop.
 */
export function DiwaliToran() {
  const [count, setCount] = useState(14);
  useEffect(() => {
    const update = () => setCount(Math.ceil(window.innerWidth / TILE) + 1);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);
  return (
    <div aria-hidden="true" data-diwali-toran className="pointer-events-none absolute inset-x-0 top-full z-10 h-[26px] select-none overflow-hidden">
      <svg width="0" height="0" className="absolute" focusable="false">
        <defs>
          <radialGradient id="diwali-glow">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="diwali-flame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#f97316" />
            <stop offset="1" stopColor="#fde047" />
          </linearGradient>
          <linearGradient id="diwali-bowl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c2410c" />
            <stop offset="1" stopColor="#7c2d12" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex">
        {Array.from({ length: count }, (_, i) => (
          <Diya key={i} />
        ))}
      </div>
    </div>
  );
}
