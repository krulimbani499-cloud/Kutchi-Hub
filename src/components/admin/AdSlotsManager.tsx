import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListAdSlots, upsertAdSlot, deleteAdSlot, type AdSlotRow } from "@/lib/plans.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

type Form = {
  id?: string; slot_key: string; name: string; description: string;
  price_monthly: number; price_yearly: number; max_active: number;
  is_active: boolean; display_order: number;
};

const emptyForm: Form = {
  slot_key: "", name: "", description: "",
  price_monthly: 0, price_yearly: 0, max_active: 1,
  is_active: true, display_order: 0,
};

export function AdSlotsManager() {
  const { data: slots = [], refetch } = useQuery({ queryKey: ["admin", "ad-slots"], queryFn: () => adminListAdSlots() });
  const upsertFn = useServerFn(upsertAdSlot);
  const deleteFn = useServerFn(deleteAdSlot);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const startNew = () => { setForm(emptyForm); setEditing("new"); };
  const startEdit = (s: AdSlotRow) => {
    setForm({
      id: s.id, slot_key: s.slot_key, name: s.name, description: s.description ?? "",
      price_monthly: Number(s.price_monthly), price_yearly: Number(s.price_yearly),
      max_active: s.max_active, is_active: s.is_active, display_order: s.display_order,
    });
    setEditing(s.id);
  };
  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.slot_key.trim() || !form.name.trim()) { toast.error("Key and name required"); return; }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: form.id, slot_key: form.slot_key, name: form.name,
          description: form.description || null,
          price_monthly: Number(form.price_monthly) || 0,
          price_yearly: Number(form.price_yearly) || 0,
          max_active: Number(form.max_active) || 1,
          is_active: form.is_active, display_order: Number(form.display_order) || 0,
        },
      });
      toast.success(form.id ? "Ad slot updated" : "Ad slot created");
      cancel(); await refetch();
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ad slot?")) return;
    try { await deleteFn({ data: { id } }); toast.success("Deleted"); await refetch(); }
    catch (e: any) { toast.error(e?.message || "Delete failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Ad Slots</h2>
          <p className="text-sm text-muted-foreground">Advertising inventory shown on /pricing.</p>
        </div>
        {editing === null && <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New slot</Button>}
      </div>

      {editing !== null && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Slot key *</Label><Input value={form.slot_key} onChange={(e) => setForm((f) => ({ ...f, slot_key: e.target.value }))} /></div>
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Monthly price (₹)</Label><Input type="number" value={form.price_monthly} onChange={(e) => setForm((f) => ({ ...f, price_monthly: Number(e.target.value) }))} /></div>
              <div><Label>Yearly price (₹)</Label><Input type="number" value={form.price_yearly} onChange={(e) => setForm((f) => ({ ...f, price_yearly: Number(e.target.value) }))} /></div>
              <div><Label>Max active ads</Label><Input type="number" value={form.max_active} onChange={(e) => setForm((f) => ({ ...f, max_active: Number(e.target.value) }))} /></div>
              <div><Label>Display order</Label><Input type="number" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} /></div>
              <label className="flex items-center gap-2 sm:col-span-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /> Active</label>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={cancel}><X className="mr-1 h-4 w-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {slots.length === 0 && editing === null && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No ad slots yet.</CardContent></Card>
        )}
        {slots.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{s.name}</h3>
                  <Badge variant="outline">{s.slot_key}</Badge>
                  {!s.is_active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  ₹{Number(s.price_monthly).toLocaleString("en-IN")}/mo · ₹{Number(s.price_yearly).toLocaleString("en-IN")}/yr · max {s.max_active} active
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="destructive" onClick={() => remove(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}