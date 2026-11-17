// One place for "share this business", used by the listing cards and the business page.
// Order: native share sheet (Capacitor app, if this installed app has the Share plugin) -> navigator.share (mobile browsers)
// -> copy the link + toast with a WhatsApp button (desktop, or an old app without the plugin). Never throws.
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

/** Always the public https address: never capacitor://, localhost or a relative path. */
export const SHARE_ORIGIN = "https://www.kutchihub.com";

export interface ShareableBusiness {
  name: string;
  slug: string;
  category?: string | null;
  city?: string | null;
}

export function businessShareUrl(slug: string): string {
  return `${SHARE_ORIGIN}/business/${encodeURIComponent(slug)}`;
}

/** "<Name> – <category>, <city> | Kutchi Hub par dekhein:" (the link is added by the caller). */
function intro(b: ShareableBusiness): string {
  const where = [b.category, b.city].filter(Boolean).join(", ");
  return `${b.name}${where ? ` – ${where}` : ""} | Kutchi Hub par dekhein:`;
}

/** The person closed the share sheet: normal, not an error. */
function isCancel(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (e instanceof Error && e.name === "AbortError") || /cancel|abort/i.test(msg);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function openWhatsApp(fullText: string) {
  try {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, "_blank", "noopener,noreferrer");
  } catch {
    /* noop */
  }
}

/** Resolves true when the business was shared or its link was copied (so the caller can count it). */
export async function shareBusiness(b: ShareableBusiness): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const url = businessShareUrl(b.slug);
  const head = intro(b);
  const fullText = `${head} ${url}`;

  // 1) Native share sheet in the app. The plugin may be missing in an older installed app: then isPluginAvailable is false.
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share")) {
      const { Share } = await import("@capacitor/share");
      try {
        // The link goes in `url` only (the sheet joins text + url, so it would show twice otherwise).
        await Share.share({ title: b.name, text: head, url, dialogTitle: "Share" });
        return true;
      } catch (e) {
        if (isCancel(e)) return false;
        /* any other failure: try the next way */
      }
    }
  } catch {
    /* plugin could not even load: try the next way */
  }

  // 2) Web Share API (phones' browsers).
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: b.name, text: head, url });
      return true;
    } catch (e) {
      if (isCancel(e)) return false;
    }
  }

  // 3) Copy the link, and offer WhatsApp.
  const copied = await copyText(fullText);
  if (copied) {
    toast.success("Link copy ho gaya", {
      action: { label: "WhatsApp", onClick: () => openWhatsApp(fullText) },
    });
  } else {
    // Even copying is blocked: WhatsApp is the last way left.
    toast.error("Link copy nahi hua", {
      action: { label: "WhatsApp", onClick: () => openWhatsApp(fullText) },
    });
  }
  return copied;
}
