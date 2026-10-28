import { useId, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE_PHONE_DISPLAY, SITE_TEL_HREF, siteWhatsappHref } from "@/lib/contact";
import { leadHeading, validateLeadForm, type LeadFormErrors } from "@/lib/search-leads";
import { submitSearchLead } from "@/lib/search-leads.functions";

/**
 * "Get the list of top <category> – free": a visitor leaves a name and a mobile number, the Kutchi Hub team calls them.
 * Saved as a search lead (admins read them in the admin panel). No sign-in, no price, nothing to pay.
 */
export function LeadForm({
  categoryId,
  categoryName,
  city,
  className = "",
}: {
  categoryId?: string | null;
  categoryName?: string | null;
  city?: string | null;
  className?: string;
}) {
  const uid = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // hidden trap field for bots
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const checked = validateLeadForm({ name, phone, consent });
    setErrors(checked.errors);
    if (Object.keys(checked.errors).length > 0 || !checked.phone) return;
    setSending(true);
    setFailure(null);
    try {
      await submitSearchLead({
        data: {
          name: checked.name,
          phone: checked.phone,
          categoryId: categoryId ?? null,
          city: city?.trim() || undefined,
          sourcePage: `${window.location.pathname}${window.location.search}`.slice(0, 300),
          consent: true,
          website,
        },
      });
      setDone(true);
    } catch (err) {
      setFailure(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <section data-lead-form data-lead-done className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center ${className}`} role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-2 text-lg font-bold text-emerald-900">Thank you!</h2>
        <p className="mt-1 text-sm text-emerald-900/80">Our team will contact you.</p>
      </section>
    );
  }

  return (
    <section data-lead-form className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      <div className="bg-gradient-to-br from-[#ff6a00] to-[#ff8a3d] px-5 py-4 text-white">
        <h2 className="text-lg font-bold leading-snug">{leadHeading(categoryName)}</h2>
        <p className="mt-1 text-sm text-white/90">Tell us where to send it. Our team will call you with the best options.</p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-3.5 p-5">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-name`}>Name</Label>
          <Input
            id={`${uid}-name`}
            name="name"
            autoComplete="name"
            value={name}
            maxLength={80}
            aria-invalid={!!errors.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-phone`}>Mobile number</Label>
          <Input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            maxLength={16}
            aria-invalid={!!errors.phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        {/* Real visitors never see or fill this; a bot that fills every field gives itself away. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <div>
          <label htmlFor={`${uid}-consent`} className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
            <Checkbox id={`${uid}-consent`} className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-invalid={!!errors.consent} />
            <span>I agree to be contacted by the Kutchi Hub team on this number (call or WhatsApp).</span>
          </label>
          {errors.consent && <p className="mt-1 text-xs text-destructive">{errors.consent}</p>}
        </div>

        {failure && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{failure}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={SITE_TEL_HREF} className="inline-flex items-center gap-1 font-semibold underline">
                <Phone className="h-3.5 w-3.5" /> {SITE_PHONE_DISPLAY}
              </a>
              <a
                href={siteWhatsappHref(`Hi Kutchi Hub, please send me the list of top ${categoryName?.trim() || "businesses"}${city ? ` in ${city}` : ""}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
          </div>
        )}

        <Button type="submit" disabled={sending} className="h-11 w-full bg-[#ff6a00] text-base font-semibold text-white hover:bg-[#e65a00]">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {sending ? "Sending…" : "Get the list – free"}
        </Button>
      </form>
    </section>
  );
}
