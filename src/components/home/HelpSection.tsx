import { Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CONTACT_EMAIL, SITE_MAILTO_HREF, SITE_PHONE_DISPLAY, SITE_TEL_HREF, WHATSAPP_HELLO_MESSAGE, siteWhatsappHref } from "@/lib/contact";
import { useT } from "@/lib/i18n";

/** Home page, just above the footer: "Need help? Talk to us" with Call / WhatsApp / Email. Details live in lib/contact.ts. */
export function HelpSection() {
  const t = useT();
  return (
    <ScrollReveal as="section" ariaLabel={t("help.title")} className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground sm:text-lg">{t("help.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("help.text")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {SITE_PHONE_DISPLAY} · <span className="break-all">{CONTACT_EMAIL}</span>
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:flex">
            <Button asChild className="h-11 bg-[#ff6a00] text-white hover:bg-[#e65a00]">
              <a href={SITE_TEL_HREF}><Phone className="mr-2 h-4 w-4" /> {t("help.call")}</a>
            </Button>
            <Button asChild className="h-11 bg-[#25D366] text-white hover:bg-[#1fb957]">
              <a href={siteWhatsappHref(WHATSAPP_HELLO_MESSAGE)} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" /> {t("help.whatsapp")}</a>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <a href={SITE_MAILTO_HREF}><Mail className="mr-2 h-4 w-4" /> {t("help.email")}</a>
            </Button>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}
