import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPlanOverview } from "@/lib/plans.functions";
import { renewalExpiryDefault } from "@/lib/subscription-utils";
import { SubscriptionForm, type SubscriptionFormInitial } from "@/components/admin/SubscriptionsManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type FormDialog = { title: string; businessName: string; initial: SubscriptionFormInitial } | null;

export function PlansRevenueOverview({
  onOpenSubscriptions,
  onOpenPending,
}: {
  onOpenSubscriptions: (plan: { id: string; name: string }) => void;
  onOpenPending: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "plan-overview"],
    queryFn: () => adminPlanOverview(),
  });
  const [showNoPlan, setShowNoPlan] = useState(false);
  const [dialog, setDialog] = useState<FormDialog>(null);

  if (isPending) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-foreground">Plans &amp; Revenue</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </section>
    );
  }
  if (isError || !data) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-foreground">Plans &amp; Revenue</h2>
        <Card><CardContent className="p-4 text-sm text-destructive">
          Could not load plans and revenue{error instanceof Error ? `: ${error.message}` : "."}
        </CardContent></Card>
      </section>
    );
  }

  const { revenue } = data;
  const closeAndRefresh = async () => {
    setDialog(null);
    // refreshes the cards, the no-plan list, the renewals and the Subscriptions tab
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold text-foreground">Plans &amp; Revenue</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.plans.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpenSubscriptions({ id: p.id, name: p.name })} className="text-left">
            <Card className="h-full transition-colors hover:border-[#ff6a00]/50">
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color || "#ff6a00" }} />
                  {p.name}{!p.isActive && " (inactive)"}
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{p.count}</p>
                <p className="text-xs text-muted-foreground">active · {inr(p.yearlyPrice)}/yr</p>
              </CardContent>
            </Card>
          </button>
        ))}

        <button type="button" onClick={() => setShowNoPlan((v) => !v)} className="text-left">
          <Card className={`h-full transition-colors hover:border-amber-500/60 ${showNoPlan ? "border-amber-500" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">No plan</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-600">{data.noPlan.length}</p>
              <p className="text-xs text-muted-foreground">published, not live</p>
            </CardContent>
          </Card>
        </button>

        <button type="button" onClick={onOpenPending} className="text-left">
          <Card className="h-full transition-colors hover:border-amber-500/60">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending approval</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-600">{data.pendingCount}</p>
              <p className="text-xs text-muted-foreground">waiting for review</p>
            </CardContent>
          </Card>
        </button>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total (amount paid, else plan price)</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600">{inr(revenue.total)}</p>
            <p className="text-xs text-muted-foreground">
              {revenue.withoutAmount === 0
                ? `all ${revenue.activeBusinesses} from recorded payments`
                : `${inr(revenue.recorded)} recorded + ${inr(revenue.byPlanPrice)} by plan price (${revenue.withoutAmount} without an amount)`}
            </p>
          </CardContent>
        </Card>
      </div>

      {showNoPlan && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="mb-2 font-semibold text-foreground">Published businesses without an active plan</h3>
            {data.noPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every published business has an active plan.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.noPlan.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.city ?? "—"}</p>
                    </div>
                    <Button size="sm" variant="outline"
                      onClick={() => setDialog({ title: "Assign plan", businessName: b.name, initial: { businessId: b.id } })}>
                      Assign plan
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="p-4">
          <h3 className="mb-2 font-semibold text-foreground">Renewals due in 30 days</h3>
          {data.renewals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No renewals due in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.renewals.map((r) => (
                <li key={r.subscriptionId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.businessName}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{r.planName}</Badge>
                      Expires {new Date(r.expiresAt).toLocaleDateString("en-IN")}
                      <span className={r.daysLeft <= 7 ? "font-medium text-destructive" : ""}>({r.daysLeft} {r.daysLeft === 1 ? "day" : "days"} left)</span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => setDialog({
                      title: "Renew plan",
                      businessName: r.businessName,
                      initial: {
                        businessId: r.businessId,
                        planId: r.planId,
                        billingCycle: "yearly",
                        expiresAt: renewalExpiryDefault(r.expiresAt),
                      },
                    })}>
                    Renew
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{dialog?.title}</DialogTitle></DialogHeader>
          {dialog && (
            <SubscriptionForm
              plans={data.planOptions}
              initial={dialog.initial}
              lockedBusinessName={dialog.businessName}
              onDone={closeAndRefresh}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
