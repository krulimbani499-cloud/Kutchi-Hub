// Shared by the admin server function and the admin UI, so the numbers always agree.
// A subscription is "active" when: status = 'active', it has started, and it has not expired.
// This is the same rule the database uses for public visibility.

export type SubLike = {
  id: string;
  business_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  started_at: string;
  expires_at: string | null;
  amount_paid: number | null;
};

export type PlanPriceLike = { price_yearly: number | null; price_monthly: number | null };

export const RENEWAL_WINDOW_DAYS = 30;

export function isSubActive(s: Pick<SubLike, "status" | "started_at" | "expires_at">, now: Date = new Date()): boolean {
  if (s.status !== "active") return false;
  if (new Date(s.started_at).getTime() > now.getTime()) return false;
  return s.expires_at == null || new Date(s.expires_at).getTime() > now.getTime();
}

/** One subscription per business: the newest-started active one (what the database cache uses). */
export function currentSubscriptions<T extends SubLike>(subs: T[], now: Date = new Date()): T[] {
  const best = new Map<string, T>();
  for (const s of subs) {
    if (!isSubActive(s, now)) continue;
    const cur = best.get(s.business_id);
    if (
      !cur ||
      new Date(s.started_at).getTime() > new Date(cur.started_at).getTime() ||
      (s.started_at === cur.started_at && s.id > cur.id)
    ) {
      best.set(s.business_id, s);
    }
  }
  return [...best.values()];
}

/** All plans are sold yearly: the plan price is the yearly price. */
export function planYearlyPrice(p: PlanPriceLike): number {
  const yearly = Number(p.price_yearly ?? 0);
  return yearly > 0 ? yearly : Number(p.price_monthly ?? 0);
}

export function addYears(date: Date, years = 1): Date {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Value for <input type="datetime-local"> (local time, minutes precision). */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default expiry for a renewal: one year after the later of "now" and the current expiry. */
export function renewalExpiryDefault(currentExpiry: string | null, now: Date = new Date()): string {
  const base = currentExpiry && new Date(currentExpiry).getTime() > now.getTime() ? new Date(currentExpiry) : now;
  return toLocalInputValue(addYears(base, 1));
}

export type OverviewPlanInput = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  tier_order: number;
  is_active: boolean;
  price_yearly: number | null;
  price_monthly: number | null;
};
export type OverviewSubInput = SubLike & { business?: { name: string; city: string | null } | null };
export type OverviewBusinessInput = { id: string; name: string; city: string | null };

export type PlanOverview = {
  plans: { id: string; name: string; slug: string; color: string | null; count: number; yearlyPrice: number; isActive: boolean }[];
  planOptions: { id: string; name: string; yearlyPrice: number }[];
  noPlan: { id: string; name: string; city: string | null }[];
  pendingCount: number;
  revenue: { total: number; recorded: number; byPlanPrice: number; withoutAmount: number; activeBusinesses: number };
  renewals: {
    subscriptionId: string;
    businessId: string;
    businessName: string;
    planId: string;
    planName: string;
    billingCycle: string;
    expiresAt: string;
    daysLeft: number;
  }[];
};

export function buildPlanOverview(args: {
  plans: OverviewPlanInput[];
  subs: OverviewSubInput[];
  publishedBusinesses: OverviewBusinessInput[];
  pendingCount: number;
  now?: Date;
}): PlanOverview {
  const now = args.now ?? new Date();
  const planById = new Map(args.plans.map((p) => [p.id, p]));
  const current = currentSubscriptions(args.subs, now);
  const activeBusinessIds = new Set(args.subs.filter((s) => isSubActive(s, now)).map((s) => s.business_id));

  const counts = new Map<string, number>();
  let recorded = 0;
  let byPlanPrice = 0;
  let withoutAmount = 0;
  for (const s of current) {
    counts.set(s.plan_id, (counts.get(s.plan_id) ?? 0) + 1);
    if (s.amount_paid != null) {
      recorded += Number(s.amount_paid);
    } else {
      const plan = planById.get(s.plan_id);
      byPlanPrice += plan ? planYearlyPrice(plan) : 0;
      withoutAmount += 1;
    }
  }

  const horizon = now.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const renewals = current
    .filter((s) => s.expires_at != null && new Date(s.expires_at).getTime() <= horizon)
    .map((s) => ({
      subscriptionId: s.id,
      businessId: s.business_id,
      businessName: s.business?.name ?? "—",
      planId: s.plan_id,
      planName: planById.get(s.plan_id)?.name ?? "—",
      billingCycle: s.billing_cycle,
      expiresAt: s.expires_at as string,
      daysLeft: Math.max(0, Math.ceil((new Date(s.expires_at as string).getTime() - now.getTime()) / 86_400_000)),
    }))
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

  return {
    plans: [...args.plans]
      .sort((a, b) => a.tier_order - b.tier_order)
      .filter((p) => p.is_active || (counts.get(p.id) ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
        count: counts.get(p.id) ?? 0,
        yearlyPrice: planYearlyPrice(p),
        isActive: p.is_active,
      })),
    planOptions: [...args.plans]
      .sort((a, b) => a.tier_order - b.tier_order)
      .map((p) => ({ id: p.id, name: p.name, yearlyPrice: planYearlyPrice(p) })),
    noPlan: args.publishedBusinesses
      .filter((b) => !activeBusinessIds.has(b.id))
      .map((b) => ({ id: b.id, name: b.name, city: b.city }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    pendingCount: args.pendingCount,
    revenue: { total: recorded + byPlanPrice, recorded, byPlanPrice, withoutAmount, activeBusinesses: current.length },
    renewals,
  };
}
