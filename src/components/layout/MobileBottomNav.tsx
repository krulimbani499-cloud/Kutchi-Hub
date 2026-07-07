import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Heart, User, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function MobileBottomNav() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { to: "/categories", label: "Categories", icon: LayoutGrid, match: (p: string) => p.startsWith("/categor") },
    { to: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
    {
      to: user ? "/favorites" : "/auth",
      label: "Saved",
      icon: Heart,
      match: (p: string) => p.startsWith("/favorites"),
    },
    {
      to: user ? "/dashboard" : "/auth",
      label: user ? "Account" : "Sign in",
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
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}