import { useEffect, useState } from "react";

const CAMPAIGN_START = "2026-08-31";
const CAMPAIGN_END = "2026-09-05"; // exclusive
const SESSION_KEY = "kutchi-hub:janmashtami-2026-seen";

function todayLocalISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWithinCampaign(): boolean {
  const today = todayLocalISODate();
  return today >= CAMPAIGN_START && today < CAMPAIGN_END;
}

export function JanmashtamiBanner() {
  const [ready, setReady] = useState(false);
  const [inWindow, setInWindow] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Date check takes priority over sessionStorage, always — bail out
    // before touching sessionStorage or arming any animation.
    if (!isWithinCampaign()) {
      setReady(true);
      return;
    }
    setInWindow(true);

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const alreadySeen = window.sessionStorage.getItem(SESSION_KEY) === "1";
    if (!prefersReduced && !alreadySeen) {
      setAnimate(true);
      window.sessionStorage.setItem(SESSION_KEY, "1");
    }
    setReady(true);
  }, []);

  if (!ready || !inWindow) return null;

  return (
    <div className="relative overflow-hidden border-b border-orange-200/60 bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5">
        <div
          className={`relative h-9 w-9 shrink-0 sm:h-10 sm:w-10 ${animate ? "janmashtami-matki-animate" : ""}`}
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-0 h-2 w-3 -translate-x-1/2 rounded-t-sm bg-[#7c2d12] sm:h-2.5 sm:w-3.5" />
          <div className="absolute left-1/2 top-1.5 h-1 w-4 -translate-x-1/2 rounded-full bg-[#9a3412] sm:top-2 sm:w-[18px]" />
          <div
            className="janmashtami-matki-pot absolute bottom-0 left-1/2 h-7 w-8 -translate-x-1/2 rounded-[50%_50%_45%_45%/60%_60%_35%_35%] sm:h-8 sm:w-9"
            style={{
              backgroundImage:
                "radial-gradient(circle, #fde68a 1px, transparent 1px), linear-gradient(180deg, #c2410c 0%, #7c2d12 100%)",
              backgroundSize: "6px 6px, 100% 100%",
              backgroundPosition: "2px 3px, 0 0",
            }}
          >
            <span
              className="janmashtami-crack absolute left-1/2 top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#fde68a]"
              style={{
                clipPath:
                  "polygon(50% 0%, 20% 22%, 62% 40%, 15% 58%, 55% 78%, 38% 100%, 30% 68%, 68% 52%, 25% 32%)",
              }}
            />
          </div>
          <span className="janmashtami-droplet janmashtami-droplet-1 absolute left-[26%] top-[54%] h-1.5 w-1.5 rounded-full bg-[#fde68a]" />
          <span className="janmashtami-droplet janmashtami-droplet-2 absolute left-[42%] top-[60%] h-1.5 w-1.5 rounded-full bg-[#fde68a]" />
          <span className="janmashtami-droplet janmashtami-droplet-3 absolute left-[58%] top-[56%] h-1.5 w-1.5 rounded-full bg-[#fde68a]" />
          <span className="janmashtami-droplet janmashtami-droplet-4 absolute left-[70%] top-[62%] h-1.5 w-1.5 rounded-full bg-[#fde68a]" />
        </div>
        <span className="text-sm font-bold text-[#7c2d12] sm:text-base">
          Jai Shree Krishna <span aria-hidden="true">🦚💙</span>
        </span>
      </div>
    </div>
  );
}
