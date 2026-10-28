import { Link } from "@tanstack/react-router";
import { Lock, MessageCircle, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EDIT_LOCKED_MESSAGE } from "@/lib/edit-lock";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_WHATSAPP } from "@/lib/contact";
import { useIsIosApp } from "@/hooks/useIsIosApp";
import { usePricingVisible } from "@/hooks/usePricingVisible";
import { ContactToActivate } from "@/components/ContactToActivate";

/**
 * Shown instead of the edit form (and instead of the services / products managers) when the owner's
 * published business has no active plan. The database enforces the same rule, this is just the explanation.
 */
export function EditLockedCard({ businessName, compact = false }: { businessName?: string; compact?: boolean }) {
  const isIosApp = useIsIosApp();
  const showPlans = usePricingVisible();
  const whatsappText = `Hi, I want to activate a plan for my business${businessName ? ` "${businessName}"` : ""} on Kutchi Hub.`;
  // Apple 3.1.1: inside the iOS app no plan wording, no pricing link, no way to pay.
  if (isIosApp) {
    return (
      <div role="status" className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground sm:p-5">
        Editing is not available for this listing right now. Contact Kutchi Hub if you need help.
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{EDIT_LOCKED_MESSAGE}</p>
          {!compact && (
            <p className="mt-1 text-sm text-amber-900/80">
              Aapka business approved aur live hai. Details, photos, products ya services badalne ke liye active plan
              zaroori hai. Plan activate karne ke liye Kutchi Hub team se sampark karein.
            </p>
          )}
          {/* Prices are hidden for everyone but admins (SHOW_PUBLIC_PRICING): Call / WhatsApp instead of "View plans". */}
          {!showPlans && <ContactToActivate className="mt-3" message={whatsappText} />}
          {showPlans && <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="bg-[#ff6a00] text-white hover:bg-[#e65a00]">
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-1.5 h-4 w-4" /> Contact Kutchi Hub
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-amber-400 bg-white/70">
              <Link to="/pricing">View plans</Link>
            </Button>
            {!compact && (
              <>
                <Button asChild size="sm" variant="ghost">
                  <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
                    <Phone className="mr-1.5 h-4 w-4" /> {CONTACT_PHONE}
                  </a>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={`mailto:${CONTACT_EMAIL}`}>
                    <Mail className="mr-1.5 h-4 w-4" /> {CONTACT_EMAIL}
                  </a>
                </Button>
              </>
            )}
          </div>}
        </div>
      </div>
    </div>
  );
}
