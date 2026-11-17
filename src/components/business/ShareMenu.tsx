import { Share2 } from "lucide-react";
import { shareBusiness, type ShareableBusiness } from "@/lib/share";

interface Props {
  business: ShareableBusiness;
  /** "text" = small "Share" link (business page); "icon" = square icon button (listing cards). */
  variant?: "text" | "icon";
  className?: string;
  onShare?: () => void;
}

/**
 * Share button. Click is fully its own: it never opens the card's business link (preventDefault + stopPropagation).
 */
export function ShareMenu({ business, variant = "text", className = "", onShare }: Props) {
  const handle = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const done = await shareBusiness(business);
    if (done) {
      try { onShare?.(); } catch { /* noop */ }
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        data-action="share"
        aria-label={`Share ${business.name}`}
        onClick={handle}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm hover:bg-muted ${className}`}
      >
        <Share2 className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      data-action="share"
      onClick={handle}
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ${className}`}
    >
      <Share2 className="h-3.5 w-3.5" /> Share
    </button>
  );
}
