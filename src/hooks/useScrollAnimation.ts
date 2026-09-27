import { useCallback, useRef } from "react";

interface UseScrollAnimationOptions {
  threshold?: number;
  enabled?: boolean;
}

// IntersectionObserver-based scroll reveal. Adds the "visible" class once,
// the first time the element enters the viewport, then stops observing.
// Skips straight to visible if the user has prefers-reduced-motion set.
// Uses a callback ref (not useRef + useEffect) so the observer attaches
// whenever the node actually mounts, even if that's a later render than
// the one where this hook was first called (e.g. a component that
// renders null until async data arrives).
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {},
) {
  const { threshold = 0.1, enabled = true } = options;
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      // A previous node is detaching, or this callback identity changed —
      // either way, stop watching whatever we were watching before.
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || !enabled || typeof window === "undefined") return;

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
      observerRef.current = observer;
    },
    [enabled, threshold],
  );

  return ref;
}
