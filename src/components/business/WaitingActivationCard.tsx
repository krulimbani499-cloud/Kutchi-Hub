import { Link } from "@tanstack/react-router";
import { Hourglass, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_WHATSAPP } from "@/lib/contact";
import { useIsIosApp } from "@/hooks/useIsIosApp";

/**
 * Shown instead of the edit form, photo upload and managers for a quick-listing business whose plan is not active yet.
 * (The database blocks owner edits in the same situation; this is the explanation.)
 */
export function WaitingActivationCard({ businessName, compact = false }: { businessName?: string; compact?: boolean }) {
  const isIosApp = useIsIosApp();
  const text = `Hi, I listed${businessName ? ` "${businessName}"` : " my business"} on Kutchi Hub. Please activate my listing.`;
  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
          <Hourglass className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">Waiting for activation</p>
          {!compact && (
            <p className="mt-1 text-sm text-amber-900/80">
              Kutchi Hub team will call you within 24 hours to activate your listing. Once your plan is active you can add your
              category, address, opening hours, photos and description.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1fb957]">
              <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp us
              </a>
            </Button>
            {/* Apple 3.1.1: no "View plans" inside the iOS app. */}
            {!isIosApp && (
              <Button asChild size="sm" variant="outline" className="border-amber-400 bg-white/70">
                <Link to="/pricing">View plans</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
