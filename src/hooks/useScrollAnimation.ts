import { useEffect, useRef } from "react";

interface UseScrollAnimationOptions {
  threshold?: number;
  enabled?: boolean;
}

// IntersectionObserver-based scroll reveal. Adds the "visible" class once,
// the first time the element enters the viewport, then stops observing.
// Skips straight to visible if the user has prefers-reduced-motion set.
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {},
) {
  const { threshold = 0.1, enabled = true } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      node.classList.add("visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, threshold]);

  return ref;
}
