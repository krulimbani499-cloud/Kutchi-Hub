import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBusinessServices, upsertBusinessService, deleteBusinessService } from "@/lib/services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, IndianRupee, Pencil, X } from "lucide-react";

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("fixed");
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setPriceUnit("fixed");
  };

  const startEdit = (s: Awaited<ReturnType<typeof listBusinessServices>>[number]) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description ?? "");
    setPrice(s.price != null ? String(s.price) : "");
    setPriceUnit(((s.price_unit as PriceUnit) ?? "fixed"));
    if (typeof window !== "undefined") window.scrollTo({ top: window.scrollY + 100, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await upsert({
        data: {
          id: editingId ?? undefined,
          businessId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: price ? Number(price) : null,
          priceUnit: price ? priceUnit : null,
        },
      });
      resetForm();
      await refetch();
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    await del({ data: { id } });
    if (editingId === id) resetForm();
    await refetch();
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
                <Button variant="ghost" size="icon" onClick={() => startEdit(s)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">{editingId ? "Edit service" : "Add a service"}</div>
          {editingId && (
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>
        <Input placeholder="Service name (e.g. AC Repair)" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Textarea placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
        <div className="flex gap-2">
          <Input type="number" step="1" min="0" placeholder="Price (₹)" value={price} onChange={(e) => setPrice(e.target.value)} className="flex-1" />
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
        <Button type="submit" disabled={busy || name.trim().length < 2} className="bg-[#ff6a00] text-white hover:bg-[#e65a00]">
          {editingId ? (
            <><Pencil className="mr-1 h-4 w-4" /> {busy ? "Saving..." : "Save changes"}</>
          ) : (
            <><Plus className="mr-1 h-4 w-4" /> {busy ? "Adding..." : "Add service"}</>
          )}
        </Button>
      </form>
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