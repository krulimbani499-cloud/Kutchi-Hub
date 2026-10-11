import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { Star, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { isWelcomeSkipped, markWelcomeSkipped } from "@/lib/welcome";
import logo from "@/assets/kutchi-hub-logo.png";

type Phase = "idle" | "checking" | "show" | "done";

// Brand tagline (Gujarati), shown the same in every language.
const WELCOME_TAGLINE = "આપણા લોકો | આપણો ધંધો | એક જ જગ્યા";

/** One of the decorative "shop cards" in the header illustration (our own shapes, no text to translate). */
function ShopCard({ className, widths }: { className: string; widths: [string, string] }) {
  return (
    <div className={`w-[6rem] shrink-0 rounded-2xl bg-white p-2 shadow-lg ${className}`} aria-hidden>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff6a00]/15 text-[#ff6a00]">
          <Store className="h-3.5 w-3.5" />
        </span>
        <span className="h-2 flex-1 rounded-full bg-neutral-200" />
      </div>
      <span className={`mb-1 block h-1.5 rounded-full bg-neutral-200 ${widths[0]}`} />
      <span className={`mb-2 block h-1.5 rounded-full bg-neutral-100 ${widths[1]}`} />
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
        ))}
      </div>
    </div>
  );
}

/**
 * Android-app-only welcome screen. It never renders on the website: everything starts after
 * mount and bails out unless Capacitor reports a native platform.
 * Back = Skip: this is a role="dialog", and the Back-button handler (NativeBackButton) closes any
 * open dialog by sending Escape, which this component treats as Skip.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [phase, setPhase] = useState<Phase>("idle");
  const [launchPath, setLaunchPath] = useState("/");

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || isWelcomeSkipped()) {
      setPhase("done");
      return;
    }
    setLaunchPath(router.state.location.pathname);
    setPhase("checking");
    let cancelled = false;

    // Local session read (no network): a logged-in user never sees this screen.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setPhase(data.session ? "done" : "show");
      })
      .catch(() => {
        if (!cancelled) setPhase("show");
      });
    // Signing in at any point (e.g. through the Sign in button) ends the welcome screen for good.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) setPhase("done");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only visible on the page the app opened on; /auth and /privacy sit on top of it, and Back returns here.
  const visible = (phase === "checking" || phase === "show") && pathname === launchPath;

  const skip = useCallback(() => {
    markWelcomeSkipped();
    setPhase("done");
  }, []);

  useEffect(() => {
    if (!visible || phase !== "show") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, phase, skip]);

  if (!visible) return null;

  // Plain orange cover while the login check runs, so the home page never flashes first.
  if (phase === "checking") {
    return <div aria-hidden className="fixed inset-0 z-[9998] bg-gradient-to-b from-[#ff6a00] to-[#e65a00]" />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kutchi Hub"
      className="fixed inset-0 z-[9998] flex flex-col overflow-y-auto bg-background"
    >
      {/* Top: brand orange with the logo and our own shop-card illustration */}
      <div className="relative flex min-h-[18rem] flex-1 flex-col overflow-hidden bg-gradient-to-b from-[#ff6a00] to-[#e65a00] pb-10">
        <span className="absolute -left-10 top-16 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <span className="absolute -right-12 bottom-6 h-52 w-52 rounded-full bg-white/10" aria-hidden />
        <span className="absolute left-1/2 top-2 h-24 w-24 -translate-x-1/2 rounded-full bg-white/5" aria-hidden />

        <div className="relative flex justify-end px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <button
            type="button"
            onClick={skip}
            className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm active:bg-white/25"
          >
            {t("welcome.skip")}
          </button>
        </div>

        {/* Logo, name and tagline on top, the three shop cards in a fan below; the group is centred vertically */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-3">
          <div className="flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-3xl bg-white shadow-2xl ring-4 ring-white/30">
            <img src={logo} alt="Kutchi Hub" className="h-[5.25rem] w-[5.25rem] object-contain" />
          </div>
          <p className="mt-3 text-2xl font-extrabold tracking-wide text-white">KUTCHI HUB</p>
          <p className="mt-1 text-center text-xs font-medium text-white/90">{WELCOME_TAGLINE}</p>

          <div className="mt-5 flex items-end justify-center gap-2">
            <ShopCard className="-rotate-6" widths={["w-4/5", "w-3/5"]} />
            <ShopCard className="-translate-y-2" widths={["w-full", "w-2/3"]} />
            <ShopCard className="rotate-6" widths={["w-3/5", "w-4/5"]} />
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="relative -mt-6 rounded-t-3xl bg-background px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-7 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <h1 className="text-center text-[1.4rem] font-extrabold leading-snug text-foreground">
          {t("welcome.headline")}
        </h1>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => void navigate({ to: "/auth", search: { mode: "signin" } })}
            className="h-12 w-full rounded-xl bg-[#ff6a00] text-base font-semibold text-white shadow-sm active:bg-[#e65a00]"
          >
            {t("nav.signIn")}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/auth", search: { mode: "signup" } })}
            className="h-12 w-full rounded-xl border-2 border-[#ff6a00] bg-background text-base font-semibold text-[#ff6a00] active:bg-[#ff6a00]/10"
          >
            {t("welcome.createAccount")}
          </button>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {t("welcome.agreePrefix")}{" "}
          <Link to="/privacy" className="font-medium text-[#ff6a00] underline underline-offset-2">
            {t("footer.privacy")}
          </Link>
          {t("welcome.agreeSuffix")}
        </p>
      </div>
    </div>
  );
}
