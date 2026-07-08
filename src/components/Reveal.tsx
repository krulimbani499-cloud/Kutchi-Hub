import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section";
}

// Fades and slides children in when they enter the viewport. Uses
// IntersectionObserver so it's cheap even for long pages.
export function Reveal({ children, className, delay = 0, y = 16, as = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
    transform: shown ? "translate3d(0,0,0)" : `translate3d(0, ${y}px, 0)`,
    opacity: shown ? 1 : 0,
  };

  const Tag = as;
  return (
    <Tag
      ref={ref as unknown as React.Ref<HTMLDivElement>}
      style={style}
      className={cn("transition-all duration-700 ease-out will-change-transform", className)}
    >
      {children}
    </Tag>
  );
}