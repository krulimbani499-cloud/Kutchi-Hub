import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Copy, Check, Share2, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getMyReferralInfo, applyReferralCode } from "@/lib/referrals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferralCard() {
  const fetchInfo = useServerFn(getMyReferralInfo);
  const applyCode = useServerFn(applyReferralCode);
  const { data, refetch } = useQuery({
    queryKey: ["referral", "me"],
    queryFn: () => fetchInfo(),
    staleTime: 30_000,
  });

  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!data) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth?ref=${data.code}`
      : `/auth?ref=${data.code}`;

  const shareText = `Join me on Kutchi Hub — discover Kutchi businesses & earn rewards! Use my code ${data.code} to get 50 bonus points 🎁 ${shareUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Join Kutchi Hub",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Invite copied — paste it anywhere!");
    } catch {
      toast.error("Share failed");
    }
  };

  const handleApply = async () => {
    if (!codeInput.trim()) return;
    setSubmitting(true);
    try {
      await applyCode({ data: { code: codeInput.trim() } });
      toast.success("Referral applied! You & your friend got bonus points 🎉");
      setCodeInput("");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-[#ff6a00]/20">
      <CardHeader className="bg-gradient-to-br from-pink-500 via-[#ff6a00] to-orange-500 text-white">
        <CardTitle className="flex items-center gap-2 text-white">
          <Gift className="h-5 w-5" />
          Invite & Earn
        </CardTitle>
        <p className="mt-1 text-xs text-white/90">
          Get <b>+100 pts</b> for every friend · they get <b>+50 pts</b> welcome bonus
        </p>
      </CardHeader>
      <CardContent className="pt-5">
        {/* Code display */}
        <div className="mb-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your code</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border-2 border-dashed border-[#ff6a00]/40 bg-gradient-to-r from-orange-50 to-pink-50 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.3em] text-[#ff6a00]">
              {data.code}
            </div>
            <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy code">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Share button */}
        <Button
          onClick={handleShare}
          className="mb-4 w-full bg-gradient-to-r from-[#ff6a00] to-pink-500 text-white hover:opacity-95"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share Invite Link
        </Button>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-black text-foreground">
              <Users className="h-5 w-5 text-[#ff6a00]" />
              {data.count}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Friends invited</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-black text-foreground">
              <Sparkles className="h-5 w-5 text-[#ff6a00]" />
              {data.pointsEarned}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Points earned</div>
          </div>
        </div>

        {/* Apply code (new users only) */}
        {data.canApplyCode ? (
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-bold text-foreground">Got a friend's code? Redeem +50 pts</p>
            <div className="flex gap-2">
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={12}
                className="font-mono uppercase tracking-widest"
              />
              <Button onClick={handleApply} disabled={submitting || codeInput.length < 4}>
                {submitting ? "…" : "Apply"}
              </Button>
            </div>
          </div>
        ) : data.wasReferred ? (
          <p className="text-center text-xs text-muted-foreground">✅ You joined via a friend's code</p>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground">
            Referral codes can only be applied within 14 days of signup
          </p>
        )}

        {/* Invited list */}
        {data.invited.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Recent invites
            </p>
            <ul className="space-y-1">
              {data.invited.slice(0, 5).map((inv) => (
                <li key={inv.referred_id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{inv.display_name || "Kutchi Member"}</span>
                  <span className="text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}