import { useMemo, useState } from "react";
import { Tag, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { claimDiscount } from "@/lib/businesses.functions";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  business: Pick<
    Tables<"businesses">,
    "id" | "name" | "app_discount_percent" | "app_discount_label" | "app_discount_valid_until"
  >;
}

export function AppDiscountCard({ business }: Props) {
  const claimFn = useServerFn(claimDiscount);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [claimed, setClaimed] = useState(false);
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(() => {
    const pct = business.app_discount_percent;
    if (typeof pct !== "number" || pct <= 0) return false;
    if (!business.app_discount_valid_until) return true;
    return new Date(business.app_discount_valid_until) >= new Date(new Date().toDateString());
  }, [business.app_discount_percent, business.app_discount_valid_until]);

  if (!active) return null;

  const handleClaim = async () => {
    if (claimed || busy) return;
    if (!isAuthenticated) {
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await claimFn({ data: { businessId: business.id } });
      setCode(res.code);
      setClaimed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim discount.");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mb-3 overflow-hidden rounded-xl border-2 border-dashed border-[#ff6a00] bg-gradient-to-br from-[#fff4ea] to-[#ffe6d1] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-white">
          <Tag className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#ff6a00]">
            <Sparkles className="h-3 w-3" /> App-exclusive offer
          </p>
          <h3 className="mt-0.5 text-lg font-extrabold text-foreground">
            {business.app_discount_percent}% OFF
            {business.app_discount_label ? (
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                — {business.app_discount_label}
              </span>
            ) : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Show this coupon at {business.name} to claim your discount.
            {business.app_discount_valid_until
              ? ` Valid until ${new Date(business.app_discount_valid_until).toLocaleDateString()}.`
              : ""}
          </p>

          {!claimed ? (
            <>
              <Button
                onClick={handleClaim}
                disabled={busy}
                size="sm"
                className="mt-3 bg-[#ff6a00] text-white hover:bg-[#e65a00]"
              >
                {busy ? "Claiming..." : "Claim & show at shop"}
              </Button>
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#ff6a00]/40 bg-white px-3 py-2">
              <span className="font-mono text-lg font-bold tracking-wider text-[#ff6a00]">
                {code}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                aria-label="Copy code"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}