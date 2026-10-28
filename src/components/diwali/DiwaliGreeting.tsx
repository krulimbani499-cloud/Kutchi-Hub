import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

const PETALS = [0, 45, 90, 135, 180, 225, 270, 315];
const DOTS = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

/** A small rangoli: rings of petals and dots in marigold, pink and red. Decoration only. */
function Rangoli({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 64" className={className}>
      <g transform="translate(32 32)">
        <circle r="30" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 3" />
        {PETALS.map((a) => (
          <ellipse key={a} cx="0" cy="-17" rx="5" ry="10" fill={a % 90 === 0 ? "#ef4444" : "#f97316"} opacity="0.9" transform={`rotate(${a})`} />
        ))}
        {DOTS.map((a) => (
          <circle key={a} cx="0" cy="-26" r="1.7" fill="#db2777" transform={`rotate(${a})`} />
        ))}
        <circle r="8" fill="#db2777" />
        <circle r="5" fill="#fde047" />
        <circle r="2" fill="#ea580c" />
      </g>
    </svg>
  );
}

/**
 * The festival greeting at the top of the home page: rangoli on both sides, the wish in the selected language, a dismiss button.
 * Text colours are dark brown on a light marigold background, so it stays readable.
 */
export function DiwaliGreeting({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  return (
    <section aria-label={t("diwali.greeting")} data-diwali-greeting className="mx-auto w-full max-w-7xl px-4 pt-4">
      <div className="relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-3 py-3 pr-12 shadow-sm sm:px-6 sm:py-4">
        <Rangoli className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" />
        <div className="min-w-0 text-center">
          <p className="text-sm font-extrabold leading-snug text-[#7c2d12] sm:text-lg">{t("diwali.greeting")}</p>
          <p className="mt-0.5 text-xs leading-snug text-[#9a3412] sm:text-sm">{t("diwali.blessing")}</p>
        </div>
        <Rangoli className="hidden h-11 w-11 shrink-0 sm:block sm:h-14 sm:w-14" />
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("diwali.dismiss")}
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[#7c2d12] transition-colors hover:bg-amber-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
