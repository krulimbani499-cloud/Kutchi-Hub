import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListPlans,
  adminListBusinessesForSubs,
  adminListSubscriptions,
  assignPlanToBusiness,
  cancelBusinessSubscription,
} from "@/lib/plans.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Ban } from "lucide-react";
import { toast } from "sonner";

export function SubscriptionsManager() {
  const { data: plans = [] } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => adminListPlans() });
  const { data: businesses = [] } = useQuery({ queryKey: ["admin", "subs-businesses"], queryFn: () => adminListBusinessesForSubs() });
  const { data: subs = [], refetch } = useQuery({ queryKey: ["admin", "subscriptions"], queryFn: () => adminListSubscriptions() });
  const assignFn = useServerFn(assignPlanToBusiness);
  const cancelFn = useServerFn(cancelBusinessSubscription);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessId: "", planId: "", billingCycle: "monthly" as "monthly" | "yearly",
    expiresAt: "", amountPaid: "", paymentRef: "", notes: "",
  });

  const filteredBiz = businesses.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  const assign = async () => {
    if (!form.businessId || !form.planId) { toast.error("Pick a business and plan"); return; }
    setSaving(true);
    try {
      await assignFn({ data: {
        businessId: form.businessId, planId: form.planId, billingCycle: form.billingCycle,
        expiresAt: form.expiresAt || null,
        amountPaid: form.amountPaid ? Number(form.amountPaid) : null,
        paymentRef: form.paymentRef || null, notes: form.notes || null,
        status: "active",
      }});
      toast.success("Plan assigned");
      setShowForm(false);
      setForm({ businessId: "", planId: "", billingCycle: "monthly", expiresAt: "", amountPaid: "", paymentRef: "", notes: "" });
      await refetch();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setSaving(false); }
  };

  const cancelSub = async (id: string) => {
    if (!confirm("Cancel this subscription?")) return;
    try { await cancelFn({ data: { id } }); toast.success("Cancelled"); await refetch(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Business Subscriptions</h2>
          <p className="text-sm text-muted-foreground">Manually assign paid plans to businesses.</p>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}><Plus className="mr-1 h-4 w-4" /> Assign plan</Button>}
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <Label>Search business</Label>
              <Input placeholder="Type business name..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                {filteredBiz.slice(0, 20).map((b) => (
                  <button key={b.id} type="button"
                    onClick={() => setForm((f) => ({ ...f, businessId: b.id }))}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${form.businessId === b.id ? "bg-muted font-medium" : ""}`}>
                    {b.name} {b.city && <span className="text-xs text-muted-foreground">— {b.city}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Plan *</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.planId} onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}>
                  <option value="">Select plan</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Billing cycle</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.billingCycle} onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value as "monthly" | "yearly" }))}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div><Label>Expires at</Label><Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} /></div>
              <div><Label>Amount paid (₹)</Label><Input type="number" value={form.amountPaid} onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Payment reference</Label><Input placeholder="Optional (UPI ref, invoice no, etc.)" value={form.paymentRef} onChange={(e) => setForm((f) => ({ ...f, paymentRef: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={assign} disabled={saving}>{saving ? "Saving..." : "Assign"}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}><X className="mr-1 h-4 w-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {subs.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">No subscriptions yet.</CardContent></Card>}
        {subs.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{s.business?.name ?? "—"}</h3>
                  <Badge className="bg-[#ff6a00] text-white">{s.plan?.name ?? "—"}</Badge>
                  <Badge variant="outline">{s.billing_cycle}</Badge>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Started {new Date(s.started_at).toLocaleDateString()}
                  {s.expires_at && ` · Expires ${new Date(s.expires_at).toLocaleDateString()}`}
                  {s.amount_paid != null && ` · ₹${Number(s.amount_paid).toLocaleString("en-IN")}`}
                </div>
                {s.notes && <div className="mt-1 text-xs text-muted-foreground">Note: {s.notes}</div>}
              </div>
              {s.status === "active" && (
                <Button size="sm" variant="outline" onClick={() => cancelSub(s.id)}><Ban className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}