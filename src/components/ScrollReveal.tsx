import type { CSSProperties, ReactNode } from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface ScrollRevealProps {
  as?: "div" | "section";
  className?: string;
  delayMs?: number;
  ariaLabel?: string;
  children: ReactNode;
}

export function ScrollReveal({ as: Tag = "div", className = "", delayMs, ariaLabel, children }: ScrollRevealProps) {
  const ref = useScrollAnimation<HTMLElement>();
  return (
    <Tag
      ref={ref as unknown as React.Ref<HTMLDivElement>}
      aria-label={ariaLabel}
      className={`animate-on-scroll ${className}`.trim()}
      style={delayMs != null ? ({ "--delay": `${delayMs}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
