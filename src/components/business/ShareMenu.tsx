import { useEffect, useRef, useState } from "react";
import { Share2, Copy, Check, MessageCircle, Facebook, Twitter, Mail } from "lucide-react";

interface Props {
  title: string;
  text?: string;
  onShare?: () => void;
}

export function ShareMenu({ title, text, onShare }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const shareText = text ?? `Check out ${title} on Kutchi Hub`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${shareText} — ${url}`);

  const track = () => {
    try { onShare?.(); } catch { /* noop */ }
  };

  const handleNativeOrOpen = () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator
        .share({ title, text: shareText, url })
        .then(() => track())
        .catch(() => setOpen(true));
      return;
    }
    setOpen((v) => !v);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const items: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; className: string }[] = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}`,
      icon: MessageCircle,
      className: "text-green-600",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: Facebook,
      className: "text-blue-600",
    },
    {
      label: "Twitter / X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
      icon: Twitter,
      className: "text-sky-500",
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`,
      icon: Mail,
      className: "text-slate-600",
    },
  ];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={handleNativeOrOpen}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-fade-in"
        >
          {items.map((it) => (
            <a
              key={it.label}
              href={it.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                track();
                setOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
              role="menuitem"
            >
              <it.icon className={`h-4 w-4 ${it.className}`} />
              <span>{it.label}</span>
            </a>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            role="menuitem"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-700">Link copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate-600" />
                <span>Copy link</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}