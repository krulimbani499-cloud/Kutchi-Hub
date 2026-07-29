import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListPlans, upsertPlan, deletePlan, type PlanRow } from "@/lib/plans.functions";
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
  id?: string;
  name: string;
  slug: string;
  tier_order: number;
  price_monthly: number;
  price_yearly: number;
  description: string;
  featuresText: string;
  color: string;
  icon: string;
  is_active: boolean;
  is_popular: boolean;
  max_photos: string;
  max_products: string;
  max_services: string;
  max_events: string;
  featured_listing: boolean;
  verified_badge: boolean;
  top_ranking: boolean;
  unlimited_leads: boolean;
  priority_support: boolean;
  analytics_access: boolean;
  banner_ad_slots: number;
};

const emptyForm: Form = {
  name: "", slug: "", tier_order: 0, price_monthly: 0, price_yearly: 0,
  description: "", featuresText: "", color: "#ff6a00", icon: "sparkles",
  is_active: true, is_popular: false,
  max_photos: "", max_products: "", max_services: "", max_events: "",
  featured_listing: false, verified_badge: false, top_ranking: false,
  unlimited_leads: false, priority_support: false, analytics_access: false,
  banner_ad_slots: 0,
};

export function PlansManager() {
  const { data: plans = [], refetch } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => adminListPlans() });
  const upsertFn = useServerFn(upsertPlan);
  const deleteFn = useServerFn(deletePlan);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const startNew = () => { setForm(emptyForm); setEditing("new"); };
  const startEdit = (p: PlanRow) => {
    setForm({
      id: p.id, name: p.name, slug: p.slug, tier_order: p.tier_order,
      price_monthly: Number(p.price_monthly), price_yearly: Number(p.price_yearly),
      description: p.description ?? "", featuresText: (p.features ?? []).join("\n"),
      color: p.color ?? "#ff6a00", icon: p.icon ?? "sparkles",
      is_active: p.is_active, is_popular: p.is_popular,
      max_photos: p.max_photos != null ? String(p.max_photos) : "",
      max_products: p.max_products != null ? String(p.max_products) : "",
      max_services: p.max_services != null ? String(p.max_services) : "",
      max_events: p.max_events != null ? String(p.max_events) : "",
      featured_listing: p.featured_listing, verified_badge: p.verified_badge,
      top_ranking: p.top_ranking, unlimited_leads: p.unlimited_leads,
      priority_support: p.priority_support, analytics_access: p.analytics_access,
      banner_ad_slots: p.banner_ad_slots,
    });
    setEditing(p.id);
  };
  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) { toast.error("Name and slug required"); return; }
    setSaving(true);
    try {
      const features = form.featuresText.split("\n").map((s) => s.trim()).filter(Boolean);
      await upsertFn({
        data: {
          id: form.id, name: form.name, slug: form.slug, tier_order: form.tier_order,
          price_monthly: Number(form.price_monthly) || 0, price_yearly: Number(form.price_yearly) || 0,
          description: form.description || null, features,
          color: form.color, icon: form.icon,
          is_active: form.is_active, is_popular: form.is_popular,
          max_photos: form.max_photos ? Number(form.max_photos) : null,
          max_products: form.max_products ? Number(form.max_products) : null,
          max_services: form.max_services ? Number(form.max_services) : null,
          max_events: form.max_events ? Number(form.max_events) : null,
          featured_listing: form.featured_listing, verified_badge: form.verified_badge,
          top_ranking: form.top_ranking, unlimited_leads: form.unlimited_leads,
          priority_support: form.priority_support, analytics_access: form.analytics_access,
          banner_ad_slots: Number(form.banner_ad_slots) || 0,
        },
      });
      toast.success(form.id ? "Plan updated" : "Plan created");
      cancel();
      await refetch();
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    try { await deleteFn({ data: { id } }); toast.success("Deleted"); await refetch(); }
    catch (e: any) { toast.error(e?.message || "Delete failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Plans & Pricing</h2>
          <p className="text-sm text-muted-foreground">Manage subscription tiers shown on /pricing.</p>
        </div>
        {editing === null && <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New plan</Button>}
      </div>

      {editing !== null && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))} /></div>
              <div><Label>Tier order</Label><Input type="number" value={form.tier_order} onChange={(e) => setForm((f) => ({ ...f, tier_order: Number(e.target.value) }))} /></div>
              <div><Label>Icon</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}>
                  <option value="sparkles">Sparkles</option>
                  <option value="shield-check">Shield</option>
                  <option value="award">Award</option>
                  <option value="crown">Crown</option>
                </select>
              </div>
              <div><Label>Monthly price (₹)</Label><Input type="number" value={form.price_monthly} onChange={(e) => setForm((f) => ({ ...f, price_monthly: Number(e.target.value) }))} /></div>
              <div><Label>Yearly price (₹)</Label><Input type="number" value={form.price_yearly} onChange={(e) => setForm((f) => ({ ...f, price_yearly: Number(e.target.value) }))} /></div>
              <div className="sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Features (one per line)</Label><Textarea rows={6} value={form.featuresText} onChange={(e) => setForm((f) => ({ ...f, featuresText: e.target.value }))} /></div>
              <div><Label>Color</Label><Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} /></div>
              <div><Label>Banner ad slots included</Label><Input type="number" value={form.banner_ad_slots} onChange={(e) => setForm((f) => ({ ...f, banner_ad_slots: Number(e.target.value) }))} /></div>
              <div><Label>Max photos</Label><Input type="number" placeholder="Leave blank for unlimited" value={form.max_photos} onChange={(e) => setForm((f) => ({ ...f, max_photos: e.target.value }))} /></div>
              <div><Label>Max products</Label><Input type="number" value={form.max_products} onChange={(e) => setForm((f) => ({ ...f, max_products: e.target.value }))} /></div>
              <div><Label>Max services</Label><Input type="number" value={form.max_services} onChange={(e) => setForm((f) => ({ ...f, max_services: e.target.value }))} /></div>
              <div><Label>Max events</Label><Input type="number" value={form.max_events} onChange={(e) => setForm((f) => ({ ...f, max_events: e.target.value }))} /></div>
            </div>

            <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
              <label className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /> Active</label>
              <label className="flex items-center gap-2"><Switch checked={form.is_popular} onCheckedChange={(v) => setForm((f) => ({ ...f, is_popular: v }))} /> Popular (highlight)</label>
              <label className="flex items-center gap-2"><Switch checked={form.featured_listing} onCheckedChange={(v) => setForm((f) => ({ ...f, featured_listing: v }))} /> Featured listing</label>
              <label className="flex items-center gap-2"><Switch checked={form.verified_badge} onCheckedChange={(v) => setForm((f) => ({ ...f, verified_badge: v }))} /> Verified badge</label>
              <label className="flex items-center gap-2"><Switch checked={form.top_ranking} onCheckedChange={(v) => setForm((f) => ({ ...f, top_ranking: v }))} /> Top ranking</label>
              <label className="flex items-center gap-2"><Switch checked={form.unlimited_leads} onCheckedChange={(v) => setForm((f) => ({ ...f, unlimited_leads: v }))} /> Unlimited leads</label>
              <label className="flex items-center gap-2"><Switch checked={form.priority_support} onCheckedChange={(v) => setForm((f) => ({ ...f, priority_support: v }))} /> Priority support</label>
              <label className="flex items-center gap-2"><Switch checked={form.analytics_access} onCheckedChange={(v) => setForm((f) => ({ ...f, analytics_access: v }))} /> Analytics access</label>
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={cancel}><X className="mr-1 h-4 w-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {plans.length === 0 && editing === null && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No plans yet.</CardContent></Card>
        )}
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: p.color ?? "#ff6a00" }} />
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <Badge variant="outline">#{p.tier_order}</Badge>
                  {p.is_popular && <Badge className="bg-[#ff6a00] text-white">Popular</Badge>}
                  {!p.is_active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  ₹{Number(p.price_monthly).toLocaleString("en-IN")}/mo · ₹{Number(p.price_yearly).toLocaleString("en-IN")}/yr · {p.features?.length ?? 0} features
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="destructive" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}