import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListPlans,
  adminListBusinessesForSubs,
  adminListSubscriptions,
  assignPlanToBusiness,
  updateBusinessSubscription,
  cancelBusinessSubscription,
} from "@/lib/plans.functions";
import { addYears, currentSubscriptions, planYearlyPrice, toLocalInputValue } from "@/lib/subscription-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Ban, Pencil } from "lucide-react";
import { toast } from "sonner";

export type SubscriptionFormInitial = {
  id?: string | null;
  businessId?: string;
  planId?: string;
  billingCycle?: "monthly" | "yearly";
  expiresAt?: string;
  amountPaid?: string;
  paymentRef?: string;
  notes?: string;
};

export type SubscriptionPlanOption = { id: string; name: string; yearlyPrice: number };

/**
 * The assign / edit / renew form. Used by the Subscriptions tab and by the Overview
 * ("Assign plan" and "Renew"), so there is exactly one copy of the save logic.
 * New assignments and renewals default to a yearly plan expiring one year from now and
 * require the amount paid; editing an existing row keeps everything optional.
 */
export function SubscriptionForm({
  plans,
  businesses = [],
  initial = {},
  lockedBusinessName,
  onDone,
  onCancel,
}: {
  plans: SubscriptionPlanOption[];
  businesses?: { id: string; name: string; city: string | null }[];
  initial?: SubscriptionFormInitial;
  lockedBusinessName?: string;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const assignFn = useServerFn(assignPlanToBusiness);
  const updateFn = useServerFn(updateBusinessSubscription);
  const isEdit = !!initial.id;
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    id: initial.id ?? null,
    businessId: initial.businessId ?? "",
    planId: initial.planId ?? "",
    billingCycle: initial.billingCycle ?? ("yearly" as "monthly" | "yearly"),
    expiresAt: initial.expiresAt ?? (initial.id ? "" : toLocalInputValue(addYears(new Date(), 1))),
    amountPaid: initial.amountPaid ?? "",
    paymentRef: initial.paymentRef ?? "",
    notes: initial.notes ?? "",
  }));

  const filteredBiz = businesses.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  const selectedPlan = plans.find((p) => p.id === form.planId);

  const save = async () => {
    if (form.id) {
      if (!form.planId) { toast.error("Pick a plan"); return; }
      setSaving(true);
      try {
        await updateFn({ data: {
          id: form.id, planId: form.planId, billingCycle: form.billingCycle,
          expiresAt: form.expiresAt || null,
          amountPaid: form.amountPaid ? Number(form.amountPaid) : null,
          paymentRef: form.paymentRef || null, notes: form.notes || null,
        }});
        toast.success("Subscription updated");
        await onDone();
      } catch (e: any) { toast.error(e?.message || "Failed"); }
      finally { setSaving(false); }
      return;
    }
    if (!form.businessId || !form.planId) { toast.error("Pick a business and plan"); return; }
    const amount = form.amountPaid.trim() === "" ? NaN : Number(form.amountPaid);
    if (Number.isNaN(amount) || amount < 0) { toast.error("Enter the amount paid"); return; }
    setSaving(true);
    try {
      await assignFn({ data: {
        businessId: form.businessId, planId: form.planId, billingCycle: form.billingCycle,
        expiresAt: form.expiresAt || null,
        amountPaid: amount,
        paymentRef: form.paymentRef || null, notes: form.notes || null,
        status: "active",
      }});
      toast.success("Plan assigned");
      await onDone();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {isEdit || lockedBusinessName ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {isEdit ? "Editing subscription for" : "Business:"}{" "}
            <span className="font-medium text-foreground">{lockedBusinessName || "—"}</span>
          </div>
        ) : (
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
        )}
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
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div><Label>Expires at</Label><Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} /></div>
          <div>
            <Label>Amount paid (₹){isEdit ? "" : " *"}</Label>
            <Input type="number" min={0} required={!isEdit} value={form.amountPaid} onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))} />
            {selectedPlan && (
              <p className="mt-1 text-xs text-muted-foreground">
                Plan price: ₹{selectedPlan.yearlyPrice.toLocaleString("en-IN")} / year{" "}
                <button type="button" className="font-medium text-primary hover:underline"
                  onClick={() => setForm((f) => ({ ...f, amountPaid: String(selectedPlan.yearlyPrice) }))}>
                  Use plan price
                </button>
              </p>
            )}
          </div>
          <div className="sm:col-span-2"><Label>Payment reference</Label><Input placeholder="Optional (UPI ref, invoice no, etc.)" value={form.paymentRef} onChange={(e) => setForm((f) => ({ ...f, paymentRef: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Assign"}
          </Button>
          <Button variant="outline" onClick={onCancel}><X className="mr-1 h-4 w-4" /> Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SubscriptionsManager({
  planFilter,
  onClearFilter,
}: {
  /** Set when arriving from an Overview plan card: show only businesses currently on this plan. */
  planFilter?: { planId: string; planName: string } | null;
  onClearFilter?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => adminListPlans() });
  const { data: businesses = [] } = useQuery({ queryKey: ["admin", "subs-businesses"], queryFn: () => adminListBusinessesForSubs() });
  const { data: subs = [], refetch } = useQuery({ queryKey: ["admin", "subscriptions"], queryFn: () => adminListSubscriptions() });
  const cancelFn = useServerFn(cancelBusinessSubscription);

  const [formState, setFormState] = useState<{ initial: SubscriptionFormInitial; businessName?: string } | null>(null);

  const planOptions: SubscriptionPlanOption[] = plans.map((p) => ({ id: p.id, name: p.name, yearlyPrice: planYearlyPrice(p) }));

  const refreshAll = async () => {
    setFormState(null);
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const startEdit = (s: (typeof subs)[number]) => {
    setFormState({
      businessName: s.business?.name ?? "",
      initial: {
        id: s.id,
        businessId: s.business_id,
        planId: s.plan_id,
        billingCycle: (s.billing_cycle as "monthly" | "yearly") ?? "monthly",
        // local time, so saving without touching the field does not shift the expiry
        expiresAt: s.expires_at ? toLocalInputValue(new Date(s.expires_at)) : "",
        amountPaid: s.amount_paid != null ? String(s.amount_paid) : "",
        paymentRef: s.payment_ref ?? "",
        notes: s.notes ?? "",
      },
    });
  };

  const cancelSub = async (id: string) => {
    if (!confirm("Cancel this subscription?")) return;
    try { await cancelFn({ data: { id } }); toast.success("Cancelled"); await refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const visibleSubs = planFilter
    ? currentSubscriptions(subs).filter((s) => s.plan_id === planFilter.planId)
    : subs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Business Subscriptions</h2>
          <p className="text-sm text-muted-foreground">Manually assign paid plans to businesses.</p>
        </div>
        {!formState && <Button onClick={() => setFormState({ initial: {} })}><Plus className="mr-1 h-4 w-4" /> Assign plan</Button>}
      </div>

      {planFilter && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">Showing active {planFilter.planName} subscriptions</Badge>
          <button type="button" onClick={onClearFilter} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Clear filter
          </button>
        </div>
      )}

      {formState && (
        <SubscriptionForm
          key={formState.initial.id ?? "new"}
          plans={planOptions}
          businesses={businesses}
          initial={formState.initial}
          lockedBusinessName={formState.businessName}
          onDone={refreshAll}
          onCancel={() => setFormState(null)}
        />
      )}

      <div className="grid gap-3">
        {visibleSubs.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">{planFilter ? "No active subscriptions on this plan." : "No subscriptions yet."}</CardContent></Card>}
        {visibleSubs.map((s) => (
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
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(s)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                {s.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => cancelSub(s.id)}><Ban className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
