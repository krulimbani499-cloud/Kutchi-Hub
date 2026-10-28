import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_PHONE, CONTACT_WHATSAPP } from "@/lib/contact";

/**
 * The action that replaces "View plans" / "Upgrade" / "Buy" while prices are hidden (see SHOW_PUBLIC_PRICING): ask the Kutchi Hub
 * team by phone or WhatsApp. The numbers come from lib/contact.ts. `message` is the ready-typed WhatsApp text.
 */
export function ContactToActivate({
  message,
  label = "Contact us to activate",
  size = "sm",
  className = "",
}: {
  message: string;
  /** The small line above the buttons; null = no line (when the text around it already says it). */
  label?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <div className={className} data-contact-to-activate>
      {label && <p className="mb-2 text-sm font-medium">{label}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size={size} className="bg-[#ff6a00] text-white hover:bg-[#e65a00]">
          <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
            <Phone className="mr-1.5 h-4 w-4" /> Call
          </a>
        </Button>
        <Button asChild size={size} className="bg-[#25D366] text-white hover:bg-[#1fb957]">
          <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
