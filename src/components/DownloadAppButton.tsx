import { PLAY_STORE_URL } from "@/lib/contact";
import { useDownloadAppMode } from "@/hooks/useDownloadApp";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The Google Play mark: four coloured facets of the play triangle. */
function PlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 26" className={className} aria-hidden="true">
      <polygon points="2,1 2,25 12.5,13" fill="#00c3ff" />
      <polygon points="2,1 12.5,13 17.6,10.4" fill="#00e676" />
      <polygon points="2,25 12.5,13 17.6,15.6" fill="#ff3d57" />
      <polygon points="17.6,10.4 22,13 17.6,15.6 12.5,13" fill="#ffd600" />
    </svg>
  );
}

/**
 * The ONE "Download App" button (Google Play badge style) to the Android app. Shown on the website in Android and desktop browsers;
 * drawn nowhere on an iPhone / iPad and inside our own apps (see useDownloadApp). The address is PLAY_STORE_URL in lib/contact.ts.
 * Desktop opens a new tab; on Android the link is followed in the same tab, which hands it to the Play Store app.
 */
export function DownloadAppButton({ className }: { className?: string }) {
  const mode = useDownloadAppMode();
  const t = useT();
  if (mode === "hide") return null;
  const label = t("home.downloadApp");
  return (
    <a
      href={PLAY_STORE_URL}
      {...(mode === "show" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-download-app
      aria-label={`${label} - Google Play`}
      className={cn(
        "inline-flex h-11 items-center gap-2.5 rounded-lg border border-white/20 bg-black px-3.5 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a00] focus-visible:ring-offset-2",
        className,
      )}
    >
      <PlayMark className="h-6 w-auto shrink-0" />
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/75">Google Play</span>
        <span className="mt-1 whitespace-nowrap text-sm font-semibold">{label}</span>
      </span>
    </a>
  );
}
