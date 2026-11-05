import { MessageCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_WHATSAPP } from "@/lib/contact";
import { sectionsUpgradeText } from "@/lib/plan-features";
import { useIsIosApp } from "@/hooks/useIsIosApp";

/**
 * Shown INSTEAD of the Services / Products sections when the business's plan does not include them (Silver): one short line and a
 * WhatsApp button. No price is shown. Inside the iOS app it renders nothing (Apple 3.1.1: no upgrade wording there).
 * `missing` = the sections the plan lacks, e.g. ["Services", "Products"].
 */
export function SectionsUpgradeCard({ missing, businessName, className = "" }: { missing: ReadonlyArray<"Services" | "Products">; businessName?: string; className?: string }) {
  const isIosApp = useIsIosApp();
  if (isIosApp || missing.length === 0) return null;
  const text = `Hi, I want to upgrade my plan to add ${missing.join(" and ")}${businessName ? ` for "${businessName}"` : ""} on Kutchi Hub.`;
  return (
    <div data-sections-upgrade className={`rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
          <Wrench className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{sectionsUpgradeText(missing)}</p>
          <Button asChild size="sm" className="mt-3 bg-[#25D366] text-white hover:bg-[#1fb957]">
            <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
