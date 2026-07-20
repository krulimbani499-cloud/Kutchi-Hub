import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Mail } from "lucide-react";
import logoUrl from "@/assets/kutchi-hub-logo.png";

const TOP_CITIES = ["Bhuj", "Gandhidham", "Anjar", "Mandvi", "Mundra", "Kapadvanj", "Nakhatrana", "Rapar"];
const TOP_CATEGORIES = [
  { slug: "restaurants", name: "Restaurants" },
  { slug: "hospitals", name: "Hospitals" },
  { slug: "doctors", name: "Doctors" },
  { slug: "grocery", name: "Grocery" },
  { slug: "hotels", name: "Hotels" },
];

function citySlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-1 font-montserrat text-xl font-bold">
            <img src={logoUrl} alt="Kutchi Hub" className="h-10 w-auto object-contain" />
            <span className="-ml-2">
              <span className="text-[#ff6a00]">KUTCHI</span> <span className="text-black">HUB</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Kutchi Hub Kutch ka apna local business directory hai — restaurants, doctors, grocery,
            shops aur services ek hi jagah. Trusted listings, real reviews aur direct contact ke saath
            hum local businesses ko customers se jodte hain aur Kutchi community ko digitally empower karte hain.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Top Cities</h4>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {TOP_CITIES.map((c) => (
              <li key={c}>
                <Link to="/city/$slug" params={{ slug: citySlug(c) }} className="hover:text-primary">{c}</Link>
              </li>
            ))}
          </ul>
          <h4 className="mt-5 text-sm font-semibold text-foreground">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/categories" className="hover:text-primary">All Categories</Link></li>
            <li><Link to="/list-your-business" className="hover:text-primary">List your business</Link></li>
            <li><Link to="/events" className="hover:text-primary">Events</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Popular Categories</h4>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {TOP_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link to="/category/$slug" params={{ slug: c.slug }} className="hover:text-primary">{c.name}</Link>
              </li>
            ))}
          </ul>
          <h4 className="mt-5 text-sm font-semibold text-foreground">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
            <li><Link to="/dashboard" className="hover:text-primary">My Listings</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Follow <span className="ml-1 rounded-full bg-[#ff6a00]/10 px-2 py-0.5 text-[10px] font-medium text-[#ff6a00]">Coming soon</span>
          </h4>
          <p className="mt-3 text-xs text-muted-foreground">@kutchihub</p>
          <div className="mt-3 flex gap-3 text-muted-foreground">
            <a href="https://instagram.com/kutchihub" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-primary"><Instagram className="h-5 w-5" /></a>
            <a href="https://facebook.com/kutchihub" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-primary"><Facebook className="h-5 w-5" /></a>
            <a href="https://x.com/kutchihub" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="hover:text-primary"><Twitter className="h-5 w-5" /></a>
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