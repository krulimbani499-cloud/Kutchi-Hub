import { Check, Crown, Award, Shield, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlanRow } from "@/lib/plans.functions";
import { perMonthPrice, periodLabel, planPeriodMonths } from "@/lib/subscription-utils";

const iconMap = {
  crown: Crown,
  award: Award,
  "shield-check": Shield,
  sparkles: Sparkles,
} as const;

interface Props {
  plan: PlanRow;
  cycle: "monthly" | "yearly";
  onSelect?: () => void;
}

export function PlanCard({ plan, cycle, onSelect }: Props) {
  const Icon = iconMap[(plan.icon ?? "sparkles") as keyof typeof iconMap] ?? Sparkles;
  const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
  const isFree = Number(price) === 0;
  const color = plan.color || "#ff6a00";
  // How long the price covers: 3 years for Silver / Gold / Platinum, a year for Enterprise (and for every plan until
  // billing_period_months exists in the database, so the card looks exactly as before).
  const months = cycle === "monthly" ? 1 : planPeriodMonths(plan);
  const periodText = cycle === "monthly" ? "mo" : months === 12 ? "yr" : periodLabel(months);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 bg-card p-6 shadow-sm transition-all hover:shadow-lg ${
        plan.is_popular ? "border-[#ff6a00] shadow-md" : "border-border"
      }`}
    >
      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[#ff6a00] px-3 py-1 text-xs text-white">Most Popular</Badge>
        </div>
      )}

      <div
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
      {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}

      <div className="mt-4">
        {isFree ? (
          <div className="text-3xl font-bold text-foreground">Free</div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">₹{Number(price).toLocaleString("en-IN")}</span>
              <span className="text-sm text-muted-foreground">/ {periodText}</span>
            </div>
            {cycle === "yearly" && months > 12 && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Just ₹{perMonthPrice(Number(price), months).toLocaleString("en-IN")}/month
              </p>
            )}
          </>
        )}
      </div>

      <ul className="mt-6 space-y-2.5 flex-1">
        {(plan.features ?? []).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff6a00]" />
            <span>{f}</span>
          </li>
        ))}
        {/* Product catalog (PDF): shown from the plan's allow_catalog flag. Hidden when the flag is missing (SQL not applied)
            or when the feature list already mentions a catalog. */}
        {plan.allow_catalog !== undefined && !(plan.features ?? []).some((f) => /catalog/i.test(f)) && (
          plan.allow_catalog ? (
            <li className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff6a00]" />
              <span>Product catalog (PDF)</span>
            </li>
          ) : (
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="line-through">Product catalog (PDF)</span>
              <span className="sr-only">not included</span>
            </li>
          )
        )}
      </ul>

      <Button
        onClick={onSelect}
        className={`mt-6 w-full ${plan.is_popular ? "bg-[#ff6a00] text-white hover:bg-[#e65a00]" : ""}`}
        variant={plan.is_popular ? "default" : "outline"}
      >
        {isFree ? "Get Started" : "Contact to Upgrade"}
      </Button>
    </div>
  );
}
