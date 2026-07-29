import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Mail } from "lucide-react";
import logoUrl from "@/assets/kutchi-hub-logo.png";
import { useT } from "@/lib/i18n";
import { LanguageSelector } from "@/components/layout/LanguageSelector";

const TOP_CATEGORIES = [
  { slug: "restaurants", key: "cat.restaurants" },
  { slug: "hospitals", key: "cat.hospitals" },
  { slug: "doctors", key: "cat.doctors" },
  { slug: "grocery", key: "cat.grocery" },
  { slug: "hotels", key: "cat.hotels" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  const t = useT();
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
          <p className="mt-3 text-sm text-muted-foreground">{t("footer.about")}</p>
          <div className="mt-4 -ml-2">
            <LanguageSelector />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">{t("footer.explore")}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/categories" className="hover:text-primary">{t("footer.allCategories")}</Link></li>
            <li><Link to="/list-your-business" className="hover:text-primary">{t("nav.listBusiness")}</Link></li>
            <li><Link to="/events" className="hover:text-primary">{t("footer.events")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">{t("home.popularCategories")}</h4>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {TOP_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link to="/category/$slug" params={{ slug: c.slug }} className="hover:text-primary">{t(c.key)}</Link>
              </li>
            ))}
          </ul>
          <h4 className="mt-5 text-sm font-semibold text-foreground">{t("footer.account")}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-primary">{t("nav.signIn")}</Link></li>
            <li><Link to="/dashboard" className="hover:text-primary">{t("nav.myListings")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">
            {t("footer.follow")} <span className="ml-1 rounded-full bg-[#ff6a00]/10 px-2 py-0.5 text-[10px] font-medium text-[#ff6a00]">{t("footer.comingSoon")}</span>
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
        &copy; {year} Kutchi Hub. {t("footer.rights")}
      </div>
    </footer>
  );
}