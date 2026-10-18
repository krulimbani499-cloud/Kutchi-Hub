import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBusinessServices, upsertBusinessService, deleteBusinessService } from "@/lib/services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, IndianRupee, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { friendlyEditError, readValidationError } from "@/lib/edit-lock";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanUpgradeCard } from "./PlanUpgradeCard";

type PriceUnit = "fixed" | "starts_at" | "per_hour" | "per_day" | "per_visit" | "per_item";

const UNIT_LABEL: Record<PriceUnit, string> = {
  fixed: "Fixed",
  starts_at: "Starts at",
  per_hour: "/ hour",
  per_day: "/ day",
  per_visit: "/ visit",
  per_item: "/ item",
};

interface Props { businessId: string }

export function ServicesManager({ businessId }: Props) {
  const { data: services = [], refetch } = useQuery({
    queryKey: ["services", businessId],
    queryFn: () => listBusinessServices({ data: { businessId } }),
  });
  const upsert = useServerFn(upsertBusinessService);
  const del = useServerFn(deleteBusinessService);
  const limits = usePlanLimits(businessId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("fixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setPriceUnit("fixed");
    setError("");
  };

  const startEdit = (s: Awaited<ReturnType<typeof listBusinessServices>>[number]) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description ?? "");
    setPrice(s.price != null ? String(s.price) : "");
    setPriceUnit(((s.price_unit as PriceUnit) ?? "fixed"));
    if (typeof window !== "undefined") window.scrollTo({ top: window.scrollY + 100, behavior: "smooth" });
  };

  // NOT a <form>: this component renders inside the BusinessForm <form>, and forms cannot nest (the browser drops the
  // inner one, so its submit button would submit the business form instead and this handler would never run).
  const handleSubmit = async () => {
    setError("");
    if (name.trim().length < 2) {
      const msg = "Service name must be at least 2 characters.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const priceNumber = price.trim() === "" ? null : Number(price);
    if (priceNumber !== null && (!Number.isFinite(priceNumber) || priceNumber < 0 || priceNumber > 9999999)) {
      const msg = "Enter a valid price (0 to 9,999,999) or leave it empty.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    try {
      const result = await upsert({
        data: {
          id: editingId ?? undefined,
          businessId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNumber,
          priceUnit: priceNumber !== null ? priceUnit : null,
        },
      });
      if (!result.ok) {
        // The server already turned the database reason into a readable sentence (plan limit, no active plan, ...).
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(editingId ? "Service updated" : "Service added");
      resetForm();
      await refetch();
    } catch (e) {
      // Thrown before/outside the handler: an input-check (zod) failure, a network error or an expired session.
      console.error("[ServicesManager] save failed:", e);
      const msg = readValidationError(e) ?? friendlyEditError(e, "Could not save service. Check your connection and try again.");
      setError(msg);
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    try {
      await del({ data: { id } });
      if (editingId === id) resetForm();
      await refetch();
    } catch (e) {
      toast.error(friendlyEditError(e, "Could not delete service. Please try again."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services added yet.</p>
        ) : (
          services.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.price != null && (
                    <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[#ff6a00]">
                      <IndianRupee className="h-3 w-3" />{s.price}
                      {s.price_unit && s.price_unit !== "fixed" && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {UNIT_LABEL[s.price_unit as PriceUnit]}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(s)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* A plan with 0 services (Silver): no add form, an upgrade card instead. Existing services stay listed and editable. */}
      {limits.services === 0 && !editingId ? (
        <PlanUpgradeCard what="Services" />
      ) : (
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">{editingId ? "Edit service" : "Add a service"}</div>
          {editingId && (
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>
        <Input
          placeholder="Service name (e.g. AC Repair)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          aria-invalid={!!error}
          // Enter saves the service, not the whole business form around it.
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSubmit(); } }}
        />
        <Textarea placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
        <div className="flex gap-2">
          <Input
            type="number" step="1" min="0" placeholder="Price (₹)" value={price} onChange={(e) => setPrice(e.target.value)} className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSubmit(); } }}
          />
          <select
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="fixed">Fixed</option>
            <option value="starts_at">Starts at</option>
            <option value="per_hour">Per hour</option>
            <option value="per_day">Per day</option>
            <option value="per_visit">Per visit</option>
            <option value="per_item">Per item</option>
          </select>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="button" onClick={() => void handleSubmit()} disabled={busy} className="bg-[#ff6a00] text-white hover:bg-[#e65a00]">
          {editingId ? (
            <><Pencil className="mr-1 h-4 w-4" /> {busy ? "Saving..." : "Save changes"}</>
          ) : (
            <><Plus className="mr-1 h-4 w-4" /> {busy ? "Adding..." : "Add service"}</>
          )}
        </Button>
      </div>
      )}
    </div>
  );
}

export function ServicesDisplay({ services }: { services: Awaited<ReturnType<typeof listBusinessServices>> }) {
  if (!services.length) return null;
  return (
    <div className="space-y-2">
      {services.map((s) => (
        <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-foreground">{s.name}</span>
              {s.price != null && (
                <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[#ff6a00]">
                  <IndianRupee className="h-3 w-3" />{s.price}
                  {s.price_unit && s.price_unit !== "fixed" && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {UNIT_LABEL[s.price_unit as PriceUnit]}
                    </span>
                  )}
                </span>
              )}
            </div>
            {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}