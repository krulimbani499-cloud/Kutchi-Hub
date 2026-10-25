import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { WHATSAPP_LISTING_MESSAGE, siteWhatsappHref } from "@/lib/contact";
import { useT } from "@/lib/i18n";

/** Pages where the button never shows: admin, dashboard / settings, forms to add or edit a business, sign-in. */
const HIDDEN_PREFIXES = ["/admin", "/dashboard", "/settings", "/auth", "/reset-password", "/business/new", "/list-your-business", "/delete-account"];
const hiddenOn = (path: string) =>
  HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) || /^\/business\/[^/]+\/(edit|claim)(\/|$)/.test(path);

const FIELD = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const MAX_CONTROL_HEIGHT = 72;
const CLICKABLE ="a, button, input, select, textarea, summary, [role='button'], [role='tab'], [role='menuitem'], [role='option']";

/**
 * Round green WhatsApp button, bottom-right, on public pages.
 *  - Sits above the bottom navigation on phones (and the iPhone home-indicator area), bottom-right corner on desktop.
 *  - Hidden on admin / dashboard / form / sign-in pages, and while the on-screen keyboard is open.
 *  - Never covers a control: whenever a small button, link or field is underneath it (a business card's Call / WhatsApp, a Save
 *    heart, a footer link ...) it fades out, and it comes back as soon as the spot is free.
 */
export function FloatingWhatsApp() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [keyboard, setKeyboard] = useState(false);
  const [covering, setCovering] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const hidden = hiddenOn(path);

  // On-screen keyboard: a field has focus, or the visual viewport shrank a lot.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => setKeyboard((e.target as Element | null)?.matches?.(FIELD) === true);
    const onFocusOut = () => setKeyboard(false);
    const vv = window.visualViewport;
    const onResize = () => {
      if (vv) setKeyboard(window.innerHeight - vv.height > 150);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);

  // Is something clickable under the button right now?
  const check = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const pad = 4;
      const xs = [r.left - pad, r.left + r.width * 0.25, r.left + r.width / 2, r.right - r.width * 0.25, r.right + pad];
      const ys = [r.top - pad, r.top + r.height * 0.25, r.top + r.height / 2, r.bottom - r.height * 0.25, r.bottom + pad];
      let under = false;
      for (const x of xs) {
        for (const y of ys) {
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
          for (const hit of document.elementsFromPoint(x, y)) {
            if (hit === el || el.contains(hit)) continue;
            const control = hit.closest(CLICKABLE);
            // Small controls only (Call / WhatsApp / Save, arrows, footer links). A whole business card or category tile is one big
            // link; sitting on top of it is fine, otherwise the button would almost never show on listing pages.
            if (control && control.getBoundingClientRect().height <= MAX_CONTROL_HEIGHT) under = true;
          }
          if (under) break;
        }
        if (under) break;
      }
      setCovering(under);
    });
  }, []);

  useEffect(() => {
    if (hidden) return;
    check();
    const opts = { passive: true } as const;
    window.addEventListener("scroll", check, opts);
    window.addEventListener("resize", check, opts);
    const interval = window.setInterval(check, 400); // content that loads in later (cards, images) moves things under the button
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearInterval(interval);
      cancelAnimationFrame(frame.current);
    };
  }, [hidden, check, path]);

  if (hidden) return null;
  const invisible = keyboard || covering;

  return (
    <a
      ref={ref}
      href={siteWhatsappHref(WHATSAPP_LISTING_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp.float")}
      title={t("whatsapp.float")}
      data-floating-whatsapp
      aria-hidden={invisible || undefined}
      tabIndex={invisible ? -1 : 0}
      // bottom: above the 5-item bottom navigation (about 58px) + iPhone home-indicator inset, with a gap; from sm up there is no bottom nav.
      style={{
        right: "max(1rem, env(safe-area-inset-right))",
        bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
      }}
      className={`fixed z-[45] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-2 ring-white transition-opacity duration-150 hover:bg-[#1fb957] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 sm:!bottom-6 ${
        invisible ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" strokeWidth={1.5} />
    </a>
  );
}
