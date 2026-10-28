import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuickListing } from "@/lib/businesses.functions";
import { CityAutocomplete } from "./CityAutocomplete";
import { isValidIndianMobile, PHONE_ERROR } from "@/lib/phone";
import { sortCategoriesAZ } from "@/lib/category-sort";
import { readValidationError } from "@/lib/edit-lock";
import { CONTACT_WHATSAPP } from "@/lib/contact";
import { useIsIosApp } from "@/hooks/useIsIosApp";
import { usePricingVisible } from "@/hooks/usePricingVisible";
import { ContactToActivate } from "@/components/ContactToActivate";

type Category = { id: string; name: string };
type Errors = Partial<Record<"name" | "contactName" | "phone" | "city", string>>;

export const QUICK_LISTING_THANK_YOU = "Thank you! Kutchi Hub team will call you within 24 hours to activate your listing.";

/** The screen after a successful submit. */
export function QuickListingThanks({ name }: { name: string }) {
  const isIosApp = useIsIosApp();
  const showPlans = usePricingVisible();
  const whatsappText = `Hi, I just listed "${name}" on Kutchi Hub. Please activate my listing.`;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8" role="status">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
      <h2 className="mt-3 text-2xl font-bold text-foreground">{QUICK_LISTING_THANK_YOU}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        "{name}" is saved. You can also message us right now to get started faster.
      </p>
      {/* Prices are hidden for everyone but admins (SHOW_PUBLIC_PRICING): Call / WhatsApp, no "View plans". */}
      {!showPlans && <ContactToActivate size="lg" className="mt-6 text-center [&>div]:justify-center" label="Contact us to activate" message={whatsappText} />}
      {showPlans && <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1fb957]">
          <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp us
          </a>
        </Button>
        {/* Apple 3.1.1: no "View plans" inside the iOS app. */}
        {!isIosApp && (
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">View plans</Link>
          </Button>
        )}
      </div>}
      <p className="mt-5 text-sm">
        <Link to="/dashboard" className="text-primary hover:underline">Go to my dashboard</Link>
      </p>
    </div>
  );
}

/** The short sign-up form for owners: 4 details (category optional); the team calls to activate the listing. */
export function QuickListingForm({ categories }: { categories: Category[] }) {
  const createFn = useServerFn(createQuickListing);
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", city: "", categoryId: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<{ name: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = "Enter the business name";
    if (form.contactName.trim().length < 2) next.contactName = "Enter the contact person's name";
    if (!isValidIndianMobile(form.phone.trim())) next.phone = PHONE_ERROR;
    if (!form.city.trim()) next.city = "Choose the city or town";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await createFn({
        data: {
          name: form.name.trim(),
          contactName: form.contactName.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          categoryId: form.categoryId || null,
        },
      });
      setDone({ name: form.name.trim() });
    } catch (err) {
      console.error("[QuickListingForm] submit failed:", err);
      const text = readValidationError(err) ?? (err instanceof Error ? err.message : "Could not save your listing. Please try again.");
      setMessage(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  };

  if (done) return <QuickListingThanks name={done.name} />;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {message && (
        <div role="alert" className="rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          {message}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="q-name">Business name *</Label>
        <Input id="q-name" value={form.name} maxLength={120} autoComplete="organization" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-contact">Contact person name *</Label>
        <Input id="q-contact" value={form.contactName} maxLength={80} autoComplete="name" onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} aria-invalid={!!errors.contactName} />
        {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-phone">Phone *</Label>
        <Input id="q-phone" type="tel" inputMode="tel" value={form.phone} maxLength={30} autoComplete="tel" placeholder="10-digit mobile number" onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} aria-invalid={!!errors.phone} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City *</Label>
        <CityAutocomplete id="city" value={form.city} onChange={(city) => setForm((f) => ({ ...f, city }))} required />
        {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-category">
          Category <span className="font-normal text-muted-foreground">— optional</span>
        </Label>
        <select
          id="q-category"
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
        >
          <option value="">Not sure yet</option>
          {sortCategoriesAZ(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="lg" disabled={busy} className="w-full bg-[#ff6a00] text-white hover:bg-[#e65a00] sm:w-auto">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {busy ? "Sending..." : "Submit"}
      </Button>
      <p className="text-xs text-muted-foreground">We will call you to activate your listing. You can add photos, address and hours after that.</p>
    </form>
  );
}
