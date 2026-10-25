import { Link } from "@tanstack/react-router";
import { Clock, Facebook, Instagram, MapPin, Mail, MessageCircle, Phone, Twitter } from "lucide-react";
import logoUrl from "@/assets/kutchi-hub-logo.png";
import { useT } from "@/lib/i18n";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import {
  CONTACT_EMAIL,
  FACEBOOK_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  SITE_ADDRESS,
  SITE_HOURS,
  SITE_MAILTO_HREF,
  SITE_PHONE_DISPLAY,
  SITE_TEL_HREF,
  WHATSAPP_HELLO_MESSAGE,
  X_URL,
  siteWhatsappHref,
} from "@/lib/contact";

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
            <li><Link to="/business/new" className="hover:text-primary">{t("nav.listBusiness")}</Link></li>
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
          <h4 className="text-sm font-semibold text-foreground">{t("footer.contact")}</h4>
          {/* tel: / mailto: / wa.me: inside the Android / iOS app Capacitor hands these to the dialer, the mail app and WhatsApp. */}
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a href={SITE_TEL_HREF} className="flex min-h-9 items-center gap-2 hover:text-primary" aria-label={`${t("footer.callUs")} ${SITE_PHONE_DISPLAY}`}>
                <Phone className="h-4 w-4 shrink-0 text-[#ff6a00]" /> {SITE_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a href={siteWhatsappHref(WHATSAPP_HELLO_MESSAGE)} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center gap-2 hover:text-primary">
                <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]" /> WhatsApp {SITE_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a href={SITE_MAILTO_HREF} className="flex min-h-9 items-center gap-2 break-all hover:text-primary">
                <Mail className="h-4 w-4 shrink-0 text-[#ff6a00]" /> {CONTACT_EMAIL}
              </a>
            </li>
            {SITE_ADDRESS && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" />
                <span><span className="sr-only">{t("footer.address")}: </span>{SITE_ADDRESS}</span>
              </li>
            )}
            {SITE_HOURS && (
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" />
                <span><span className="sr-only">{t("footer.hours")}: </span>{SITE_HOURS}</span>
              </li>
            )}
          </ul>
          <h4 className="mt-5 text-sm font-semibold text-foreground">{t("footer.follow")}</h4>
          {/* Instagram is live. target=_blank: a new tab on the website; inside the Android / iOS app Capacitor opens links to other
              sites outside the app (Instagram app if installed, else the browser), never inside our web view. */}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t("footer.followInstagram")} (${INSTAGRAM_HANDLE})`}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-[#ff6a00]/50 hover:text-primary"
          >
            <Instagram className="h-5 w-5 shrink-0" />
            <span>{t("footer.followInstagram")}</span>
          </a>
          <p className="mt-2 text-xs text-muted-foreground">{INSTAGRAM_HANDLE}</p>
          {/* Facebook / X are hidden until FACEBOOK_URL / X_URL in contact.ts hold an address (nothing is left behind: no icon, no tag, no gap). */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground">
            {FACEBOOK_URL && (
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-primary"><Facebook className="h-5 w-5" /></a>
            )}
            {X_URL && (
              <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="hover:text-primary"><Twitter className="h-5 w-5" /></a>
            )}
            <a href={`mailto:${CONTACT_EMAIL}`} aria-label="Email" className="hover:text-primary"><Mail className="h-5 w-5" /></a>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border-t border-border px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:gap-4">
        <span>&copy; {year} Kutchi Hub. {t("footer.rights")}</span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-primary">{t("footer.privacy")}</Link>
          <Link to="/delete-account" className="hover:text-primary">{t("footer.deleteAccount")}</Link>
        </span>
      </div>
    </footer>
  );
}