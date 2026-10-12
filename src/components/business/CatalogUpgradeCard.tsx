import { Link } from "@tanstack/react-router";
import { FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATALOG_PLAN_MESSAGE } from "@/lib/edit-lock";
import { CONTACT_WHATSAPP } from "@/lib/contact";

/** Shown instead of the catalog uploader when the business's plan does not include the catalog (Silver). */
export function CatalogUpgradeCard({ businessName, hasExistingCatalog }: { businessName?: string; hasExistingCatalog?: boolean }) {
  const text = `Hi, I want to upgrade my plan to use the product catalog${businessName ? ` for "${businessName}"` : ""} on Kutchi Hub.`;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{CATALOG_PLAN_MESSAGE}</p>
          {hasExistingCatalog && (
            <p className="mt-1 text-xs text-amber-900/80">
              Aapka purana catalog saved hai, par customers ko tab tak nahi dikhega jab tak plan upgrade nahi hota.
            </p>
          )}
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
        </div>
      </div>
    </div>
  );
}
