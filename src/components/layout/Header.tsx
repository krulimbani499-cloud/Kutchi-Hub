import { Link, useRouterState } from "@tanstack/react-router";
import { Search, Menu, User, LogOut, Heart, Shield, Tag, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logoUrl from "@/assets/kutchi-hub-logo.png";
import { CitySelector } from "@/components/layout/CitySelector";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { useT } from "@/lib/i18n";
import { usePricingVisible } from "@/hooks/usePricingVisible";

/**
 * TEMPORARY: the home page already has its own search (location picker + mic) in the hero, so the header search is hidden there.
 * Set this to false to bring the header search back on the home page. Every other page always keeps it.
 * (A page can also force it with the `hideSearch` prop of <Header />.)
 */
export const HIDE_HEADER_SEARCH_ON_HOME = true;

export function Header({ hideSearch }: { hideSearch?: boolean } = {}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hideHeaderSearch = hideSearch ?? (HIDE_HEADER_SEARCH_ON_HOME && pathname === "/");
  const { user, isLoading } = useAuth();
  const t = useT();
  const showPricing = usePricingVisible(); // false for everyone but admins while SHOW_PUBLIC_PRICING is off (and always in the iOS app)
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasListings, setHasListings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (!cancelled) setIsAdmin(!!data);
    });
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .then(({ count }) => {
        if (!cancelled) setHasListings((count ?? 0) > 0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white shadow-sm">
      <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 sm:flex sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-0">
        <Link to="/" className="flex min-w-0 shrink items-center gap-0 font-bold -ml-2 sm:-ml-1">
          <img src={logoUrl} alt="Kutchi Hub" className="h-11 w-auto shrink-0 object-contain sm:h-12" />
          <span className="-ml-6 sm:-ml-8 whitespace-nowrap text-base min-[400px]:text-lg sm:text-2xl tracking-tight uppercase font-['Baloo_2',system-ui,sans-serif] font-extrabold">
            <span className="text-[#ff6a00]">KUTCHI</span> <span className="text-black">HUB</span>
          </span>
        </Link>

        <div className="hidden sm:ml-auto sm:flex shrink-0 items-center rounded-md border border-border sm:px-1 sm:py-1 text-sm text-foreground">
          <CitySelector compact />
        </div>

        {!hideHeaderSearch && (
          <form
            className="relative order-last col-span-2 flex min-w-0 items-stretch overflow-hidden rounded-md border border-border bg-white focus-within:border-[#ff6a00] sm:order-none sm:col-span-1 sm:flex-1 sm:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(search.trim())}`;
              }
            }}
          >
            <Input
              type="search"
              placeholder="Search businesses..."
              aria-label={t("nav.search")}
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex shrink-0 items-center justify-center bg-[#ff6a00] px-3 text-white hover:bg-[#e65a00] transition-colors sm:px-4"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        )}

        <div className="flex shrink-0 items-center gap-0.5 sm:ml-0 sm:gap-2">
          <LanguageSelector compact />
          <Button variant="ghost" size="icon" className="hidden sm:flex" asChild>
            <Link to="/categories" title={t("nav.categories")}>
              <Menu className="h-5 w-5" />
            </Link>
          </Button>
          {showPricing && (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link to="/pricing">{t("nav.pricing")}</Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" asChild title={t("nav.pricing")}>
                <Link to="/pricing" aria-label={t("nav.pricing")}>
                  <Tag className="h-5 w-5" />
                </Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/about">{t("nav.about")}</Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" asChild title={t("nav.about")}>
            <Link to="/about" aria-label={t("nav.about")}>
              <Info className="h-5 w-5" />
            </Link>
          </Button>

          {!isLoading && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  <NotificationsBell />
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                        <Link to="/admin">{t("nav.admin")}</Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" asChild title={t("nav.admin")}>
                        <Link to="/admin" aria-label={t("nav.admin")}>
                          <Shield className="h-5 w-5 text-[#ff6a00]" />
                        </Link>
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild title={t("nav.favorites")}>
                    <Link to="/favorites" aria-label={t("nav.favorites")}>
                      <Heart className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                    {isAdmin ? (
                      <Link to="/dashboard">
                        <User className="mr-1 h-4 w-4" />
                        {t("nav.listings")}
                      </Link>
                    ) : hasListings ? (
                      <Link to="/dashboard">
                        <User className="mr-1 h-4 w-4" />
                        {t("nav.myListings")}
                      </Link>
                    ) : (
                      <Link to="/business/new">
                        <User className="mr-1 h-4 w-4" />
                        {t("nav.listBusiness")}
                      </Link>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                    className="hidden sm:inline-flex"
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    {t("nav.signOut")}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" asChild>
                    <Link to={isAdmin || hasListings ? "/dashboard" : "/business/new"}>
                      <User className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="h-8 bg-primary px-2.5 text-primary-foreground sm:h-9 sm:px-3" asChild>
                  <Link to="/auth">{t("nav.signIn")}</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
