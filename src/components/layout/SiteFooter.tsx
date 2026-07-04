import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Mail } from "lucide-react";
import logoUrl from "@/assets/kutchi-hub-logo.png";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-1 text-xl font-bold text-foreground">
            <img src={logoUrl} alt="Kutchi Hub" className="h-10 w-auto object-contain" />
            <span className="-ml-2 bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
              Kutchi Hub
            </span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Discover the best local businesses across India — restaurants, doctors, salons and more.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/categories" className="hover:text-primary">Categories</Link></li>
            <li><Link to="/search" className="hover:text-primary">Search</Link></li>
            <li><Link to="/business/new" className="hover:text-primary">List your business</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
            <li><Link to="/dashboard" className="hover:text-primary">My Listings</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Follow</h4>
          <div className="mt-3 flex gap-3 text-muted-foreground">
            <a href="#" aria-label="Facebook" className="hover:text-primary"><Facebook className="h-5 w-5" /></a>
            <a href="#" aria-label="Instagram" className="hover:text-primary"><Instagram className="h-5 w-5" /></a>
            <a href="#" aria-label="Twitter" className="hover:text-primary"><Twitter className="h-5 w-5" /></a>
            <a href="mailto:hello@kutchihub.com" aria-label="Email" className="hover:text-primary"><Mail className="h-5 w-5" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        &copy; {year} Kutchi Hub. All rights reserved.
      </div>
    </footer>
  );
}