import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { applyReferralCode } from "@/lib/referrals.functions";

import appCss from "../styles.css?url";
import logoIcon from "@/assets/kutchi-hub-logo.png";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BASE_URL, SITE_NAME, ldScript, organizationLd, websiteLd } from "@/lib/seo";
import { ComingSoonGate } from "@/components/ComingSoonGate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kutchi Hub — Local Business Directory in Kutch" },
      { name: "description", content: "Discover trusted local businesses in Kutch — restaurants, doctors, grocery, shops and services. Read reviews, get contact info and directions on Kutchi Hub." },
      { name: "author", content: "Kutchi Hub" },
      { name: "google-site-verification", content: "MQzK7pzfxlreZYVwzU_wgDRGwj70BJ1xBgc6O2aOHds" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_IN" },
      { property: "og:title", content: "Kutchi Hub — Local Business Directory in Kutch" },
      { property: "og:description", content: "Discover trusted local businesses in Kutch — restaurants, doctors, grocery, shops and services. Read reviews, get contact info and directions on Kutchi Hub." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BASE_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@kutchihub" },
      { name: "theme-color", content: "#ff6a00" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Kutchi Hub" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&family=Montserrat:wght@700;800&family=Baloo+2:wght@700;800&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
    scripts: [ldScript(organizationLd()), ldScript(websiteLd())],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") {
          queryClient.invalidateQueries();
        }
        if (event === "SIGNED_IN") {
          try {
            const pending = typeof window !== "undefined" ? localStorage.getItem("kh:pending_referral") : null;
            if (pending) {
              applyReferralCode({ data: { code: pending } })
                .then(() => {
                  try { localStorage.removeItem("kh:pending_referral"); } catch { /* ignore */ }
                  queryClient.invalidateQueries({ queryKey: ["referral"] });
                  queryClient.invalidateQueries({ queryKey: ["gamification"] });
                })
                .catch(() => { /* silent — user can still redeem from dashboard */ });
            }
          } catch { /* ignore */ }
        }
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ComingSoonGate>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 pb-16 sm:pb-0">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </main>
          <MobileBottomNav />
          <SiteFooter />
        </div>
      </ComingSoonGate>
    </QueryClientProvider>
  );
}
