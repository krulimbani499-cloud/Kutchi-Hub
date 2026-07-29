import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Heart, User, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export function MobileBottomNav() {
  const { user } = useAuth();
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: t("nav.home"), icon: Home, match: (p: string) => p === "/" },
    { to: "/categories", label: t("nav.categories"), icon: LayoutGrid, match: (p: string) => p.startsWith("/categor") },
    { to: "/search", label: t("nav.searchShort"), icon: Search, match: (p: string) => p.startsWith("/search") },
    {
      to: user ? "/favorites" : "/auth",
      label: t("nav.saved"),
      icon: Heart,
      match: (p: string) => p.startsWith("/favorites"),
    },
    {
      to: user ? "/dashboard" : "/auth",
      label: user ? t("nav.account") : t("nav.signIn"),
      icon: User,
      match: (p: string) => p.startsWith("/dashboard") || p.startsWith("/auth"),
    },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Bottom navigation"
    >
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.match(path);
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <Link
                to={it.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-[#ff6a00]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="truncate max-w-full px-0.5">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}