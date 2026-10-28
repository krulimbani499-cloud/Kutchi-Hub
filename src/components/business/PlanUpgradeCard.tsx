import { Link } from "@tanstack/react-router";
import { Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_WHATSAPP } from "@/lib/contact";
import { useIsIosApp } from "@/hooks/useIsIosApp";
import { usePricingVisible } from "@/hooks/usePricingVisible";
import { ContactToActivate } from "@/components/ContactToActivate";

/**
 * Shown instead of an "add" form when the business's plan allows none of this kind (e.g. Silver: 0 products).
 * Existing items are untouched and stay listed above it; only adding new ones is closed.
 */
export function PlanUpgradeCard({ what, businessName }: { what: "Products" | "Services"; businessName?: string }) {
  const isIosApp = useIsIosApp();
  const showPlans = usePricingVisible();
  const text = `Hi, I want to upgrade my plan to add ${what.toLowerCase()}${businessName ? ` for "${businessName}"` : ""} on Kutchi Hub.`;
  // Apple 3.1.1: inside the iOS app no upgrade / plan wording and no way to pay.
  if (isIosApp) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        Adding {what.toLowerCase()} is not available for this listing.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{what} add karna Gold plan me available hai</p>
          <p className="mt-1 text-xs text-amber-900/80">Aapke jo {what.toLowerCase()} pehle se saved hain wo as it is rahenge.</p>
          {/* Prices are hidden for everyone but admins (SHOW_PUBLIC_PRICING): Call / WhatsApp instead of "Upgrade". */}
          {showPlans ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" className="bg-[#ff6a00] text-white hover:bg-[#e65a00]">
                <Link to="/pricing">Upgrade</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-amber-400 bg-white/70">
                <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" /> Contact Kutchi Hub
                </a>
              </Button>
            </div>
          ) : (
            <ContactToActivate className="mt-3" message={text} />
          )}
        </div>
      </div>
    </div>
  );
}
