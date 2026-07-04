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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-0 text-2xl font-bold -ml-1">
          <img src={logoUrl} alt="Kutchi Hub" className="h-12 w-auto object-contain" />
          <span className="hidden sm:inline -ml-5 tracking-tight uppercase font-['Montserrat',sans-serif] font-bold">
            <span className="text-[#f26c22]">KUTCHI</span> <span className="text-black">HUB</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground">
          <CitySelector compact />
        </div>

        <form
          className="relative flex flex-1 max-w-xl items-stretch overflow-hidden rounded-md border border-border bg-white focus-within:border-[#16a34a]"
          onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) {
              window.location.href = `/search?q=${encodeURIComponent(search.trim())}`;
            }
          }}
        >
          <Input
            type="search"
            placeholder="Search for restaurants, hospitals, salons..."
            className="h-10 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex items-center justify-center bg-[#16a34a] px-4 text-white hover:bg-[#15803d] transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
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
