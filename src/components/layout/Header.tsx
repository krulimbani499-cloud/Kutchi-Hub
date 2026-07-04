import { Link } from "@tanstack/react-router";
import { Search, Menu, User, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logoUrl from "@/assets/kutchi-hub-logo.png";
import { CitySelector } from "@/components/layout/CitySelector";

export function Header() {
  const { user, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (!cancelled) setIsAdmin(!!data);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-0 text-2xl font-bold -ml-1">
          <img src={logoUrl} alt="Kutchi Hub" className="h-12 w-auto object-contain" />
          <span className="hidden sm:inline -ml-3 tracking-tight uppercase text-primary">KUTCHI HUB</span>
        </Link>

        <CitySelector compact className="hidden md:inline-flex" />

        <form
          className="relative flex-1 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) {
              window.location.href = `/search?q=${encodeURIComponent(search.trim())}`;
            }
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search restaurants, hospitals, salons..."
            className="h-10 border-input bg-background pl-9 pr-4 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:flex" asChild>
            <Link to="/categories" title="Categories">
              <Menu className="h-5 w-5" />
            </Link>
          </Button>

          {!isLoading && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                      <Link to="/admin">Admin</Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                    <Link to="/dashboard">
                      <User className="mr-1 h-4 w-4" />
                      My Listings
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                    className="hidden sm:inline-flex"
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    Sign out
                  </Button>
                  <Button variant="ghost" size="icon" className="sm:hidden" asChild>
                    <Link to="/dashboard">
                      <User className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="bg-primary text-primary-foreground" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
