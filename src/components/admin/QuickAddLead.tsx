import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Phone, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminQuickAddBusiness, adminRecentQuickLeads, getCategories } from "@/lib/businesses.functions";
import { CityAutocomplete } from "@/components/business/CityAutocomplete";
import { isValidIndianMobile, PHONE_ERROR, telHref, whatsappHref } from "@/lib/phone";
import { sortCategoriesAZ } from "@/lib/category-sort";
import { readValidationError } from "@/lib/edit-lock";

const STORE_KEY = "kh:quick-add:v1";
type Kept = { categoryId: string; city: string; source: string };
type Errors = Partial<Record<"name" | "contactName" | "phone" | "categoryId" | "city", string>>;
type Duplicate = { id: string; name: string; slug: string; city: string | null; status: string; phone: string | null };

const readKept = (): Kept => {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Kept>;
      return { categoryId: v.categoryId ?? "", city: v.city ?? "", source: v.source ?? "" };
    }
  } catch {
    /* storage unavailable */
  }
  return { categoryId: "", city: "", source: "" };
};

/**
 * Admin "Quick add": a 4-field form for collecting leads on a phone at an event. Business name, contact person and phone change
 * for every lead; Category, City and Source are KEPT after each save (and remembered for next time) so the next entry is fast.
 * Saves exactly like the owner quick listing (pending, quick lead, owner = this admin). A phone that already exists is shown first.
 */
export function QuickAddLead({ onSaved }: { onSaved: () => void | Promise<void> }) {
  const queryClient = useQueryClient();
  const addFn = useServerFn(adminQuickAddBusiness);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => getCategories(), staleTime: 10 * 60_000 });
  const { data: recent = [] } = useQuery({ queryKey: ["admin", "recent-quick-leads"], queryFn: () => adminRecentQuickLeads() });
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", categoryId: "", city: "", source: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Category / City / Source of the last entry (this device), so a new session continues where the last one stopped.
  useEffect(() => {
    setForm((f) => ({ ...f, ...readKept() }));
  }, []);

  const keep = (next: Kept) => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const save = async (force: boolean) => {
    if (busy) return;
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = "Enter the business name";
    if (form.contactName.trim().length < 2) next.contactName = "Enter the contact person's name";
    if (!isValidIndianMobile(form.phone.trim())) next.phone = PHONE_ERROR;
    if (!form.categoryId) next.categoryId = "Choose a category";
    if (!form.city.trim()) next.city = "Choose the city or town";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const res = await addFn({
        data: {
          name: form.name.trim(),
          contactName: form.contactName.trim(),
          phone: form.phone.trim(),
          categoryId: form.categoryId,
          city: form.city.trim(),
          source: form.source.trim() || null,
          force,
        },
      });
      if (res.duplicate) {
        setDuplicate(res.duplicate);
        return;
      }
      setDuplicate(null);
      toast.success(res.sourceSaved ? "Saved" : "Saved (the source was not stored: run supabase/pending/quick-add first)");
      keep({ categoryId: form.categoryId, city: form.city, source: form.source });
      // Clear what changes per lead; keep Category / City / Source.
      setForm((f) => ({ ...f, name: "", contactName: "", phone: "" }));
      setErrors({});
      void queryClient.invalidateQueries({ queryKey: ["admin", "recent-quick-leads"] });
      await onSaved();
      nameRef.current?.focus();
    } catch (e) {
      const text = readValidationError(e) ?? (e instanceof Error ? e.message : "Could not save the lead.");
      setMessage(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, error?: string, children?: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );

  return (
    <Card className="border-[#ff6a00]/40">
      <CardContent className="space-y-4 p-4">
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          {message && <p role="alert" className="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground">{message}</p>}
          {field("qa-name", "Business name *", errors.name,
            <Input id="qa-name" ref={nameRef} value={form.name} maxLength={120} autoComplete="off" onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setDuplicate(null); }} aria-invalid={!!errors.name} />,
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("qa-contact", "Contact person *", errors.contactName,
              <Input id="qa-contact" value={form.contactName} maxLength={80} autoComplete="off" onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} aria-invalid={!!errors.contactName} />,
            )}
            {field("qa-phone", "Phone *", errors.phone,
              <Input id="qa-phone" type="tel" inputMode="tel" value={form.phone} maxLength={30} autoComplete="off" placeholder="10-digit mobile" onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setDuplicate(null); }} aria-invalid={!!errors.phone} />,
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("qa-category", "Category *", errors.categoryId,
              <select
                id="qa-category"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                aria-invalid={!!errors.categoryId}
              >
                <option value="">Choose a category</option>
                {sortCategoriesAZ(categories).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>,
            )}
            {field("city", "City *", errors.city,
              <CityAutocomplete id="city" value={form.city} onChange={(city) => setForm((f) => ({ ...f, city }))} required />,
            )}
          </div>
          {field("qa-source", "Source (event / stall)", undefined,
            <Input id="qa-source" value={form.source} maxLength={120} autoComplete="off" placeholder="e.g. Kapadvanj Expo 2026" onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />,
          )}

          {duplicate && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="flex items-start gap-2 font-semibold">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> This phone number already exists
              </p>
              <p className="mt-1 break-words">
                <strong>{duplicate.name}</strong> · {duplicate.city ?? "no city"} · <span className="capitalize">{duplicate.status}</span> · {duplicate.phone}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void save(true)}>Save anyway</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDuplicate(null)}>Cancel</Button>
              </div>
            </div>
          )}

          <Button type="submit" size="lg" disabled={busy} className="h-12 w-full bg-[#ff6a00] text-base text-white hover:bg-[#e65a00]">
            {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />} Save lead
          </Button>
        </form>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-foreground">Last {recent.length || 5} entries</p>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="break-words font-medium text-foreground">{r.name}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {[r.contactName, r.categoryName, r.city, r.leadSource].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {r.phone && (
                    <div className="flex items-center gap-2">
                      <a href={telHref(r.phone)} className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"><Phone className="h-3.5 w-3.5" />{r.phone}</a>
                      {whatsappHref(r.phone) && (
                        <a href={whatsappHref(r.phone)!} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-green-700"><MessageCircle className="h-4 w-4" /></a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
